/**
 * One-off: Google's embedding model names move between v1beta releases, so
 * this hits :embedContent for both candidate model names with a throwaway
 * string and reports which returns 200 -- the winner is recorded in
 * PERSONAL_OS_LOG.md. src/lib/ai/embed.ts tries text-embedding-004 first and
 * still falls back to gemini-embedding-001 at runtime regardless of this
 * result, in case Google flips which one is current again later.
 *
 *   node scripts/probe-embedding-model.mjs
 *
 * GEMINI_API_KEY is loaded from .env.local via dotenv and never printed.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env.local") });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(
    "GEMINI_API_KEY not found in .env.local -- get a free key at https://aistudio.google.com, " +
      "add it to .env.local, then re-run this."
  );
  process.exit(1);
}

const CANDIDATES = ["text-embedding-004", "gemini-embedding-001"];

for (const model of CANDIDATES) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${model}`,
        content: { parts: [{ text: "test" }] },
        outputDimensionality: 768,
      }),
    });
    const body = await res.text();
    console.log(`${model}: HTTP ${res.status}`);
    if (!res.ok) {
      console.log(`  ${body.slice(0, 300)}`);
    } else {
      const parsed = JSON.parse(body);
      console.log(`  values length: ${parsed.embedding?.values?.length ?? "?"}`);
    }
  } catch (e) {
    console.log(`${model}: request failed -- ${String(e)}`);
  }
}
