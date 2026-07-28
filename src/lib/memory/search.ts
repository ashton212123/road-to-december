import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { embed } from "@/lib/ai/embed";

export type MemorySearchResult = {
  sourceType: string;
  sourceId: string;
  sourceDate: string | null;
  text: string;
  metadata: Record<string, unknown> | null;
};

/**
 * Hybrid search (§6b): a vector pass (cosine distance via pgvector's `<=>`)
 * ranks by meaning, a keyword pass (ILIKE + full-text, one combined query)
 * catches exact terms -- a lift name or a split time -- the embedding alone
 * can miss. Two sequential round trips (never Promise.all, §3.1), merged
 * and deduped by (sourceType, sourceId) with vector hits ranked first since
 * they're already similarity-ordered.
 */
export async function searchMemory(query: string, limit = 20): Promise<MemorySearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const queryEmbedding = await embed(trimmed);

  const vectorRows = queryEmbedding
    ? ((await db.execute(sql`
        select source_type as "sourceType", source_id as "sourceId", source_date as "sourceDate", text, metadata
        from memory_chunks
        where embedding is not null
        order by embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        limit ${limit}
      `)) as unknown as MemorySearchResult[])
    : [];

  const keywordRows = (await db.execute(sql`
    select source_type as "sourceType", source_id as "sourceId", source_date as "sourceDate", text, metadata
    from memory_chunks
    where text ilike ${`%${trimmed}%`} or to_tsvector('english', text) @@ plainto_tsquery('english', ${trimmed})
    limit ${limit}
  `)) as unknown as MemorySearchResult[];

  const merged = new Map<string, MemorySearchResult>();
  for (const row of [...vectorRows, ...keywordRows]) {
    const key = `${row.sourceType}:${row.sourceId}`;
    if (!merged.has(key)) merged.set(key, row);
  }
  return [...merged.values()].slice(0, limit);
}
