/**
 * One-off, idempotent: settings.energy_phase used to be NOT NULL DEFAULT
 * 'gain' (loop 32, never wired to any feature). Loop 38 repurposes the
 * column so null = "auto-follow the season calendar" and non-null = an
 * explicit override -- but the existing singleton row still holds the old
 * schema default 'gain', which was never an intentional choice and would
 * otherwise be misread as a permanent manual override, silently blocking
 * the auto phase-transition this loop exists to deliver. Clears it back to
 * null exactly once. Never touches a row where the value differs from the
 * old default (that would mean it really was set deliberately).
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

const result = await sql`update settings set energy_phase = null where energy_phase = 'gain'`;
console.log(`settings: ${result.count} row(s) reset energy_phase 'gain' -> null (auto)`);

await sql.end();
