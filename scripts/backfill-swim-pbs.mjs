/**
 * One-off, applied 2026-07-21: seed the athlete's real personal bests into
 * swim_times as race results (isPb: true, meetName set) so meet-readiness
 * projections have real race data to work from instead of blending in
 * practice times. Date is approximate (pre-season, before the June gap) --
 * these are known PBs being backfilled, not a specific meet result.
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

const PBS = [
  { event: "50 Breast", timeMs: 30_460 },
  { event: "100 Breast", timeMs: 65_870 },
  { event: "200 Breast", timeMs: 144_530 },
  { event: "200 IM", timeMs: 130_870 },
  { event: "400 IM", timeMs: 287_000 },
];

const DATE = "2026-05-31";
const MEET_NAME = "Pre-season PB";

let inserted = 0;
for (const pb of PBS) {
  const existing = await sql`
    select id from swim_times where event = ${pb.event} and time_ms = ${pb.timeMs} limit 1
  `;
  if (existing.length > 0) {
    console.log(`SKIP  ${pb.event} ${pb.timeMs}ms -- already exists (id ${existing[0].id})`);
    continue;
  }
  await sql`
    insert into swim_times (date, event, time_ms, meet_name, is_pb)
    values (${DATE}, ${pb.event}, ${pb.timeMs}, ${MEET_NAME}, true)
  `;
  inserted++;
  console.log(`OK    ${pb.event} ${pb.timeMs}ms`);
}

console.log(`\nInserted ${inserted}/${PBS.length} PB rows.`);
await sql.end();
