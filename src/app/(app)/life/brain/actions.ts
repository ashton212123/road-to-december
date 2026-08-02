"use server";

import { getChunksByCategory } from "@/lib/memory/queries";
import { resolveSourceHref, type BrainCategory } from "@/lib/memory/categories";
import { callGroqChat } from "@/lib/ai/groq";

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

export type CategoryDetail = {
  summary: string | null;
  chunks: { sourceType: string; sourceId: string; sourceDate: string | null; text: string; href: string | null }[];
};

/** §6d: tapping a category tile lists everything in it plus an AI summary of
 * current state and open loops. Loaded on demand (not pre-fetched for all 8
 * tiles on page load) -- one Groq call per tap, not one per tile per visit. */
export async function getCategoryDetailAction(category: BrainCategory): Promise<CategoryDetail> {
  const rows = await getChunksByCategory(category);

  const summaryResult =
    rows.length === 0
      ? null
      : await callGroqChat(
          [
            {
              role: "system",
              content: `Summarize the current state of "${category}" for Ashton in 2-4 sentences, using ONLY the data provided. Call out any open loops -- unfinished tasks, missing recent data, concerning trends -- if present. Second person ("you"), factual, no fluff.`,
            },
            {
              role: "user",
              content: rows
                .slice(0, 40)
                .map((r) => `[${r.sourceType}:${r.sourceId}]${r.sourceDate ? ` (${r.sourceDate})` : ""} ${truncate(r.text, 300)}`)
                .join("\n"),
            },
          ],
          { temperature: 0.3 }
        );
  const summary = summaryResult?.ok ? summaryResult.content : null;

  return {
    summary,
    chunks: rows.map((r) => ({
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      sourceDate: r.sourceDate,
      text: r.text,
      href: resolveSourceHref(r.sourceType, r.sourceId, r.metadata),
    })),
  };
}
