/**
 * Manual schema-apply helper -- the replacement for `drizzle-kit push`
 * (crashes: TypeError in its own CHECK-constraint introspection) and
 * `drizzle-kit migrate` (unreliable exit codes on this PowerShell setup).
 *
 * Flow: edit schema.ts -> `npx drizzle-kit generate` -> apply the generated
 * SQL with this script, which is the only thing that touches the live DB.
 *
 *   node scripts/apply-migration.mjs 0011_foo.sql
 *
 * DATABASE_URL is loaded from .env.local via dotenv and never printed.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(ROOT, ".env.local") });

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <filename in drizzle/>");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL not found in .env.local");
  process.exit(1);
}

const sqlPath = path.join(ROOT, "drizzle", file);
const text = readFileSync(sqlPath, "utf8");
const statements = text
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

const sql = postgres(connectionString, { prepare: false, max: 1 });

let failed = false;
for (const statement of statements) {
  const firstLine = statement.split("\n")[0].slice(0, 80);
  try {
    await sql.unsafe(statement);
    console.log(`OK    ${firstLine}`);
  } catch (e) {
    failed = true;
    console.log(`ERROR ${firstLine}`);
    console.error(`      ${e.message}`);
  }
}

await sql.end();
process.exit(failed ? 1 : 0);
