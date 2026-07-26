/**
 * One-off, idempotent: backfill swim_times.course and meets.course for rows
 * logged before the course column existed (Phase 6, loop 32). He races LCM
 * (meets have a meet_name) and trains SCM (everything else) -- this is the
 * only signal available for historical rows, so it's a best-effort backfill,
 * not a measurement. Never touches rows that already have a course.
 *
 * DATABASE_URL from .env.local. Sequential queries -- shares prod's small
 * connection pool, speed doesn't matter for a one-off.
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

const nullCourseTimes = await sql`select count(*)::int as n from swim_times where course is null`;
const nullCourseCount = nullCourseTimes[0].n;

if (nullCourseCount === 0) {
  console.log("No swim_times rows with null course -- nothing to backfill.");
} else {
  const lcmResult = await sql`
    update swim_times set course = 'LCM' where course is null and meet_name is not null
  `;
  const scmResult = await sql`
    update swim_times set course = 'SCM' where course is null
  `;
  console.log(`swim_times: ${lcmResult.count} -> LCM (has meet_name), ${scmResult.count} -> SCM (remaining)`);
}

const meetsResult = await sql`update meets set course = 'LCM' where course is null`;
console.log(`meets: ${meetsResult.count} -> LCM`);

await sql.end();
