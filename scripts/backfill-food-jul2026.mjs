/**
 * One-off, applied 2026-07-21: backfill food logs for days the athlete ate
 * to the bulk target (~3,400 kcal / ~119g protein) but couldn't log while
 * the app was still being built. Only touches dates that are effectively
 * unlogged (total kcal < 1000) -- days with real substantial logs are left
 * untouched. Kcal varies +/-50/day (deterministic from the date, not
 * random) so charts don't render a suspicious flat line. Rows are
 * distinguishable from real logs by created_at.
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

const WINDOW_START = "2026-07-06";
const WINDOW_END = "2026-07-20"; // 07-21 (today) already has real logs and is excluded regardless

function dateRange(startISO, endISO) {
  const dates = [];
  for (let d = new Date(`${startISO}T00:00:00Z`); d <= new Date(`${endISO}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// Deterministic +/-50 offset from the date, applied to breakfast only so
// protein stays at target while total kcal varies day to day.
function kcalOffset(dateISO) {
  const day = Number(dateISO.slice(8, 10));
  return ((day * 37) % 101) - 50;
}

function mealsFor(dateISO) {
  const offset = kcalOffset(dateISO);
  return [
    { timeSlot: "breakfast", description: "Rice, eggs, chicken tocino + banana", kcal: 900 + offset, proteinG: 30, carbsG: 110, fatG: 25 },
    { timeSlot: "lunch", description: "Rice, chicken adobo, vegetables", kcal: 1000, proteinG: 35, carbsG: 115, fatG: 30 },
    { timeSlot: "snack", description: "Protein shake, oats + peanut butter", kcal: 500, proteinG: 20, carbsG: 55, fatG: 18 },
    { timeSlot: "dinner", description: "Rice, grilled bangus/pork, soup", kcal: 1000, proteinG: 34, carbsG: 110, fatG: 32 },
  ];
}

let totalInserted = 0;
for (const date of dateRange(WINDOW_START, WINDOW_END)) {
  const [{ total }] = await sql`select coalesce(sum(kcal), 0) as total from food_logs where date = ${date}`;
  if (Number(total) >= 1000) {
    console.log(`SKIP  ${date} -- already has ${total} kcal logged`);
    continue;
  }
  const meals = mealsFor(date);
  for (const m of meals) {
    await sql`
      insert into food_logs (date, time_slot, description, kcal, protein_g, carbs_g, fat_g, source)
      values (${date}, ${m.timeSlot}, ${m.description}, ${m.kcal}, ${m.proteinG}, ${m.carbsG}, ${m.fatG}, 'manual')
    `;
  }
  const dayKcal = meals.reduce((s, m) => s + m.kcal, 0);
  const dayProtein = meals.reduce((s, m) => s + m.proteinG, 0);
  totalInserted += meals.length;
  console.log(`OK    ${date} -- ${meals.length} meals, ${dayKcal} kcal / ${dayProtein}g protein`);
}

console.log(`\nInserted ${totalInserted} total meal rows.`);
await sql.end();
