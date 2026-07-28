/**
 * One-off: enables the pgvector extension on the Supabase Postgres database
 * so schema.ts's `vector(768)` column (memory_chunks.embedding) and its
 * HNSW index can exist. Idempotent -- safe to re-run.
 *
 *   node scripts/enable-pgvector.mjs
 *
 * DATABASE_URL is loaded from .env.local via dotenv and never printed.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env.local") });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sql = postgres(connectionString, { prepare: false, max: 1 });

await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
const [{ extversion }] = await sql`SELECT extversion FROM pg_extension WHERE extname = 'vector';`;
console.log(`pgvector extension enabled (version ${extversion}).`);

await sql.end();
