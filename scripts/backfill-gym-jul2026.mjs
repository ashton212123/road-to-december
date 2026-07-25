/**
 * One-off, applied 2026-07-21: backfill gym logs for every P1 "Rebuild"
 * session the athlete actually trained (Tue/Thu/Sun, 2026-07-06 through
 * 2026-07-19) but couldn't log while the app was still being built. Weights
 * are reconstructed estimates -- guessed from the P1 re-entry intensity
 * (RPE <=7) and week-1/week-2 load bumps, not measured. Rows are
 * distinguishable from real logs by created_at (this script's run time vs.
 * the actual training date).
 *
 * Only P1 needs backfilling: P2 "Muscle + Base" starts 2026-07-20 (a
 * Monday, no session), and 2026-07-21 (today, P2's first Tue) already has
 * real logged data -- any date with an existing workout_logs row is
 * skipped automatically, so today is untouched regardless.
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

// date -> dayKey, restricted to P1's window (2026-07-06 to 2026-07-19).
const BACKFILL_DATES = [
  { date: "2026-07-07", dayKey: "tue", week: 1 },
  { date: "2026-07-09", dayKey: "thu", week: 1 },
  { date: "2026-07-12", dayKey: "sun", week: 1 },
  { date: "2026-07-14", dayKey: "tue", week: 2 },
  { date: "2026-07-16", dayKey: "thu", week: 2 },
  { date: "2026-07-19", dayKey: "sun", week: 2 },
];

// Week-1 working weights (kg), by exact exercise name. Pair-total DB
// exercises stored as the combined number, matching how this app logs DB work
// elsewhere. Anything not listed here is bodyweight/no-load (weightKg null).
const WEEK1_WEIGHTS = {
  "Goblet box squat": 20,
  "DB Romanian deadlift": 36,
  "Rear-foot split squat": 24,
  "½-kneel landmine press": 20,
  "Trap-bar deadlift (technique)": 70,
  "DB bench press": 32,
  "Lat pulldown": 45,
  "Barbell glute bridge": 60,
  "Straight-arm pulldown": 25,
  "Face pull": 15,
  "Pallof press": 15,
  "Suitcase carry": 24,
};

// "week 2: small load bumps" -- applies to the Tue main/secondary lifts only.
const WEEK2_BUMP = new Set(["Goblet box squat", "DB Romanian deadlift", "Rear-foot split squat", "½-kneel landmine press"]);
const WEEK2_BUMP_KG = 2.5;

function weightFor(name, week) {
  const base = WEEK1_WEIGHTS[name];
  if (base === undefined) return null;
  return week === 2 && WEEK2_BUMP.has(name) ? base + WEEK2_BUMP_KG : base;
}

// RPE: an exercise the program itself prescribes an intensity for (rpeMin/Max
// set in the DB) is a "main" for that day -- backfilled at P1's re-entry
// ceiling of 7.0. Everything else is an accessory at 6.5. Never above 7 --
// P1 is technique/re-entry, not a push phase.
function rpeFor(hasPrescribedRpe) {
  return hasPrescribedRpe ? 7.0 : 6.5;
}

const existingDates = new Set((await sql`select distinct date from workout_logs`).map((r) => r.date.toISOString().slice(0, 10)));

const sessionRows = await sql`
  select s.id as session_id, s.day_key,
         e.id as exercise_id, e.name, e.target_sets, e.target_reps_min, e.target_reps_max, e.rpe_min
  from sessions s
  join exercises e on e.session_id = s.id
  where s.phase_id = 'p1'
  order by s.day_key, e.order_index
`;
const exercisesByDay = new Map();
for (const r of sessionRows) {
  const list = exercisesByDay.get(r.day_key) ?? [];
  list.push(r);
  exercisesByDay.set(r.day_key, list);
}

let totalInserted = 0;
for (const { date, dayKey, week } of BACKFILL_DATES) {
  if (existingDates.has(date)) {
    console.log(`SKIP  ${date} (${dayKey}) -- already has logged data`);
    continue;
  }
  const exercises = exercisesByDay.get(dayKey) ?? [];
  let dateInserted = 0;
  for (const ex of exercises) {
    const sets = ex.target_sets ?? 3;
    const reps = ex.target_reps_max ?? ex.target_reps_min ?? 8;
    const weightKg = weightFor(ex.name, week);
    const rpe = rpeFor(ex.rpe_min !== null);
    for (let setNumber = 1; setNumber <= sets; setNumber++) {
      await sql`
        insert into workout_logs (date, exercise_id, set_number, weight_kg, reps, rpe, rest_seconds, notes)
        values (${date}, ${ex.exercise_id}, ${setNumber}, ${weightKg}, ${reps}, ${rpe}, null, null)
      `;
      dateInserted++;
    }
  }
  totalInserted += dateInserted;
  console.log(`OK    ${date} (${dayKey}) -- ${dateInserted} sets across ${exercises.length} exercises`);
}

console.log(`\nInserted ${totalInserted} total set rows.`);
await sql.end();
