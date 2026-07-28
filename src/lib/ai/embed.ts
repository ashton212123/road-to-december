/**
 * Google embeddings client, same defensive shape as ai/groq.ts: never
 * throws -- callers get `null` on a missing key, network error, or bad
 * response, and are expected to have a non-AI fallback (or, for
 * lib/memory/write.ts, to just skip the embedding and keep the write).
 *
 * Model names move between v1beta releases, so every call tries
 * `text-embedding-004` first and falls back to `gemini-embedding-001` if
 * that name 404s/errors -- see scripts/probe-embedding-model.mjs for the
 * one-off check of which is currently live (result recorded in
 * PERSONAL_OS_LOG.md), and scripts/scratch-embed-test.ts for a real
 * end-to-end check against this file.
 */

const EMBED_MODELS = ["text-embedding-004", "gemini-embedding-001"] as const;
const DIMENSIONS = 768;
const BATCH_SIZE = 100;
const BATCH_PAUSE_MS = 1000;

function embedUrl(model: string, apiKey: string, method: "embedContent" | "batchEmbedContents") {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}?key=${apiKey}`;
}

async function embedOnce(text: string, apiKey: string): Promise<number[] | null> {
  for (const model of EMBED_MODELS) {
    try {
      const res = await fetch(embedUrl(model, apiKey, "embedContent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          outputDimensionality: DIMENSIONS,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { embedding?: { values?: number[] } };
      const values = data.embedding?.values;
      if (values && values.length === DIMENSIONS) return values;
    } catch {
      // try the next model name
    }
  }
  return null;
}

async function embedBatchOnce(texts: string[], apiKey: string): Promise<(number[] | null)[]> {
  for (const model of EMBED_MODELS) {
    try {
      const res = await fetch(embedUrl(model, apiKey, "batchEmbedContents"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
            outputDimensionality: DIMENSIONS,
          })),
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { embeddings?: { values?: number[] }[] };
      const embeddings = data.embeddings;
      if (!embeddings || embeddings.length !== texts.length) continue;
      return embeddings.map((e) => (e.values && e.values.length === DIMENSIONS ? e.values : null));
    } catch {
      // try the next model name
    }
  }
  return texts.map(() => null);
}

export async function embed(text: string): Promise<number[] | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return embedOnce(text, apiKey);
}

export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return texts.map(() => null);

  const results: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const chunk = texts.slice(i, i + BATCH_SIZE);
    results.push(...(await embedBatchOnce(chunk, apiKey)));
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
    }
  }
  return results;
}
