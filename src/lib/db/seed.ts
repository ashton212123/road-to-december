import "./load-env";
import { sql } from "drizzle-orm";
import { db } from "./index";
import { phases, sessions, exercises, weighIns, settings } from "./schema";
import { seasonData } from "../data/season-data";
import { parsePrescription } from "../train/parse-prescription";
import type { SeedSession } from "../data/types";

const DAY_KEYS = ["tue", "thu", "sun"] as const;

async function seedPhasesSessionsExercises() {
  for (const [phaseIndex, phase] of seasonData.PHASES.entries()) {
    await db
      .insert(phases)
      .values({
        id: phase.id,
        tag: phase.tag,
        name: phase.name,
        weeks: phase.weeks,
        dates: phase.dates,
        color: phase.color,
        blurb: phase.blurb,
        note: phase.note ?? null,
        startDate: phase.start,
        endDate: phase.end,
        isDeload: phase.isDeload ?? false,
        deloadWeek: phase.deloadWeek ?? null,
        isRaceBlock: phase.isRaceBlock ?? false,
        waveScheme: phase.waveScheme ?? null,
        blocks: phase.blocks ?? null,
        orderIndex: phaseIndex,
      })
      .onConflictDoUpdate({
        target: phases.id,
        set: {
          tag: phase.tag,
          name: phase.name,
          weeks: phase.weeks,
          dates: phase.dates,
          color: phase.color,
          blurb: phase.blurb,
          note: phase.note ?? null,
          startDate: phase.start,
          endDate: phase.end,
          isDeload: phase.isDeload ?? false,
          deloadWeek: phase.deloadWeek ?? null,
          isRaceBlock: phase.isRaceBlock ?? false,
          waveScheme: phase.waveScheme ?? null,
          blocks: phase.blocks ?? null,
          orderIndex: phaseIndex,
        },
      });

    if (!phase.sessions) continue;

    for (const [dayIndex, dayKey] of DAY_KEYS.entries()) {
      const seedSession = phase.sessions[dayKey] as SeedSession | undefined;
      if (!seedSession) continue;

      const [sessionRow] = await db
        .insert(sessions)
        .values({
          phaseId: phase.id,
          dayKey,
          title: seedSession.title,
          orderIndex: dayIndex,
        })
        .onConflictDoUpdate({
          target: [sessions.phaseId, sessions.dayKey],
          set: { title: seedSession.title, orderIndex: dayIndex },
        })
        .returning();

      for (const [exIndex, ex] of seedSession.exercises.entries()) {
        const parsed = parsePrescription(ex.sets);
        await db
          .insert(exercises)
          .values({
            sessionId: sessionRow.id,
            name: ex.name,
            prescription: ex.sets,
            targetSets: parsed.targetSets,
            targetRepsMin: parsed.targetRepsMin,
            targetRepsMax: parsed.targetRepsMax,
            pct1rmMin: parsed.pct1rmMin !== null ? String(parsed.pct1rmMin) : null,
            pct1rmMax: parsed.pct1rmMax !== null ? String(parsed.pct1rmMax) : null,
            rpeMin: parsed.rpeMin !== null ? String(parsed.rpeMin) : null,
            rpeMax: parsed.rpeMax !== null ? String(parsed.rpeMax) : null,
            isExplosive: ex.isExplosive ?? false,
            isMainLift: ex.isMainLift ?? false,
            isMonitor: ex.isMonitor ?? false,
            movementPattern: ex.movementPattern ?? null,
            orderIndex: exIndex,
          })
          .onConflictDoUpdate({
            target: [exercises.sessionId, exercises.orderIndex],
            set: {
              name: ex.name,
              prescription: ex.sets,
              targetSets: parsed.targetSets,
              targetRepsMin: parsed.targetRepsMin,
              targetRepsMax: parsed.targetRepsMax,
              pct1rmMin: parsed.pct1rmMin !== null ? String(parsed.pct1rmMin) : null,
              pct1rmMax: parsed.pct1rmMax !== null ? String(parsed.pct1rmMax) : null,
              rpeMin: parsed.rpeMin !== null ? String(parsed.rpeMin) : null,
              rpeMax: parsed.rpeMax !== null ? String(parsed.rpeMax) : null,
              isExplosive: ex.isExplosive ?? false,
              isMainLift: ex.isMainLift ?? false,
              isMonitor: ex.isMonitor ?? false,
              movementPattern: ex.movementPattern ?? null,
            },
          });
      }
    }
  }
}

async function seedWeighIns() {
  for (const w of seasonData.weighIns) {
    await db
      .insert(weighIns)
      .values({ date: w.date, kg: String(w.weight) })
      .onConflictDoUpdate({ target: weighIns.date, set: { kg: String(w.weight) } });
  }
}

async function seedSettings() {
  await db
    .insert(settings)
    .values({
      id: "singleton",
      aseanConfirmed: seasonData.meta.targets.aseanConfirmed,
      waterTargetMl: 3000,
      weightUnit: "kg",
    })
    .onConflictDoNothing({ target: settings.id });
}

async function main() {
  console.log("Seeding phases, sessions, exercises...");
  await seedPhasesSessionsExercises();
  console.log("Seeding baseline weigh-ins...");
  await seedWeighIns();
  console.log("Ensuring settings singleton exists...");
  await seedSettings();

  const countRows = await db.select({ count: sql<number>`count(*)::int` }).from(phases);
  console.log(`Done. ${countRows[0]?.count ?? 0} phases in database.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
