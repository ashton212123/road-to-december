/**
 * One-off: settings.energy_phase moves from NOT NULL DEFAULT 'gain' to a
 * plain nullable column (loop 38) -- null now means "auto-follow the
 * season calendar", non-null means an explicit override. drizzle-kit push
 * is interactive and can't run headless here, so this applies the exact
 * same ALTER TABLE directly. Idempotent (IF EXISTS / safe re-run).
 *
 * DATABASE_URL from .env.local.
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

await sql`alter table settings alter column energy_phase drop not null`;
await sql`alter table settings alter column energy_phase drop default`;
console.log("settings.energy_phase is now nullable with no default.");

await sql.end();
