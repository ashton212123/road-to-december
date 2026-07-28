import { inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { memoryChunks } from "@/lib/db/schema";
import { sourceTypesForCategory, type BrainCategory } from "./categories";

export type MemoryChunkRow = {
  sourceType: string;
  sourceId: string;
  sourceDate: string | null;
  text: string;
  metadata: Record<string, unknown> | null;
};

export async function getChunksByCategory(category: BrainCategory, limit = 100): Promise<MemoryChunkRow[]> {
  const types = sourceTypesForCategory(category);
  if (types.length === 0) return [];

  const rows = await db
    .select({
      sourceType: memoryChunks.sourceType,
      sourceId: memoryChunks.sourceId,
      sourceDate: memoryChunks.sourceDate,
      text: memoryChunks.text,
      metadata: memoryChunks.metadata,
    })
    .from(memoryChunks)
    .where(inArray(memoryChunks.sourceType, types))
    .orderBy(desc(memoryChunks.sourceDate))
    .limit(limit);

  return rows as MemoryChunkRow[];
}
