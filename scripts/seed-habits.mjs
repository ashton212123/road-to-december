/**
 * One-off, Phase 4: seed the six grouped habits from the Personal OS spec
 * (§4a) into the `habits` table. Idempotent -- skips any habit whose name
 * already exists so re-running after a partial failure is safe.
 *
 * DATABASE_URL from .env.local. Sequential queries, single connection --
 * shares prod's small pool, speed doesn't matter for a one-off.
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

const HABITS = [
  {
    name: "Morning",
    category: "routine",
    subtasks: [
      { id: "hydrate", label: "Hydrate" },
      { id: "weigh-in", label: "Weigh in" },
      { id: "check-plan", label: "Check today's plan" },
    ],
  },
  {
    name: "Pool session",
    category: "swim",
    subtasks: [
      { id: "warm-up", label: "Warm-up" },
      { id: "main-set", label: "Main set" },
      { id: "log-session", label: "Log the session" },
    ],
  },
  {
    name: "Gym session",
    category: "train",
    subtasks: [
      { id: "session-complete", label: "Session complete" },
      { id: "log-sets", label: "Log the sets" },
    ],
  },
  {
    name: "Fuel",
    category: "fuel",
    subtasks: [
      { id: "protein-target", label: "Hit protein target" },
      { id: "water-target", label: "Hit water target" },
      { id: "pre-session-carbs", label: "Pre-session carbs" },
    ],
  },
  {
    name: "School block",
    category: "school",
    subtasks: [
      { id: "homework-done", label: "Homework done" },
      { id: "assignments-checked", label: "Assignments checked" },
    ],
  },
  {
    name: "Evening wind-down",
    category: "recovery",
    subtasks: [
      { id: "journal", label: "Journal" },
      { id: "log-sleep", label: "Log sleep" },
      { id: "screens-off", label: "Screens off" },
    ],
  },
];

let inserted = 0;
for (let i = 0; i < HABITS.length; i++) {
  const h = HABITS[i];
  const existing = await sql`select id from habits where name = ${h.name} limit 1`;
  if (existing.length > 0) {
    console.log(`SKIP  ${h.name} -- already exists (id ${existing[0].id})`);
    continue;
  }
  await sql`
    insert into habits (name, category, sort_order, subtasks, active)
    values (${h.name}, ${h.category}, ${i}, ${sql.json(h.subtasks)}, true)
  `;
  inserted++;
  console.log(`OK    ${h.name} (${h.category}, ${h.subtasks.length} subtasks)`);
}

console.log(`\nInserted ${inserted}/${HABITS.length} habit rows.`);
await sql.end();
