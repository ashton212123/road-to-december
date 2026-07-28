import { db } from "@/lib/db";
import { memoryChunks } from "@/lib/db/schema";
import { embed } from "@/lib/ai/embed";

/**
 * Embeds `input.text` and upserts a memory_chunks row on (sourceType,
 * sourceId) -- the Brain's (Phase 6) and the capture pipeline's (Phase 2)
 * shared write path into the vector store. Never throws: a failed embedding
 * (missing key, network error, bad response) must never fail the write that
 * triggered it, so this stores the row anyway with a null embedding and
 * just logs the failure.
 */
export async function rememberChunk(input: {
  sourceType: string;
  sourceId: string;
  sourceDate?: string;
  text: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  let embedding: number[] | null = null;
  try {
    embedding = await embed(input.text);
  } catch (err) {
    console.error(`rememberChunk: embed() threw for ${input.sourceType}:${input.sourceId}`, err);
  }

  try {
    await db
      .insert(memoryChunks)
      .values({
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceDate: input.sourceDate ?? null,
        text: input.text,
        embedding,
        metadata: input.metadata ?? null,
      })
      .onConflictDoUpdate({
        target: [memoryChunks.sourceType, memoryChunks.sourceId],
        set: {
          sourceDate: input.sourceDate ?? null,
          text: input.text,
          embedding,
          metadata: input.metadata ?? null,
        },
      });
  } catch (err) {
    console.error(`rememberChunk: write failed for ${input.sourceType}:${input.sourceId}`, err);
  }
}
