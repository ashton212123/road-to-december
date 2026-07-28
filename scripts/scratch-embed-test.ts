/**
 * Phase 1 gate check: exercises the real src/lib/ai/embed.ts end-to-end and
 * confirms it returns a 768-length vector for a real string. Run with tsx:
 *
 *   npx tsx scripts/scratch-embed-test.ts
 *
 * GEMINI_API_KEY is loaded from .env.local via dotenv and never printed.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env.local") });

async function main() {
  const { embed } = await import("../src/lib/ai/embed");

  const result = await embed("test");
  if (!result) {
    console.error("embed('test') returned null -- check GEMINI_API_KEY in .env.local, or the API call failed.");
    process.exit(1);
  }
  console.log(`embed('test') returned a ${result.length}-length array.`);
  console.log(result.slice(0, 5));
}

main();
