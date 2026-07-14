import { asc, desc, eq, gte } from "drizzle-orm";
import { db } from "./index";
import {
  phases,
  sessions,
  exercises,
  weighIns,
  cmjTests,
  foodLogs,
  waterLogs,
  settings,
  sleepLogs,
  workoutLogs,
  swimTimes,
  timeTo15m,
  jumpTests,
  sorenessLogs,
} from "./schema";
import { todayManilaISO, addDaysISO } from "../time";
import { seasonData } from "../data/season-data";

export async function getSettingsRow() {
  const rows = await db.select().from(settings).where(eq(settings.id, "singleton")).limit(1);
  if (rows[0]) return rows[0];
  const [created] = await db
    .insert(settings)
    .values({
      id: "singleton",
      aseanConfirmed: seasonData.meta.targets.aseanConfirmed,
      waterTargetMl: 3000,
      weightUnit: "kg",
    })
    .returning();
  return created;
}

export async function getAllPhasesWithSessions() {
  const phaseRows = await db.select().from(phases).orderBy(asc(phases.orderIndex));
  const sessionRows = await db.select().from(sessions).orderBy(asc(sessions.orderIndex));
  const exerciseRows = await db.select().from(exercises).orderBy(asc(exercises.orderIndex));

  return phaseRows.map((phase) => ({
    ...phase,
    sessions: sessionRows
      .filter((s) => s.phaseId === phase.id)
      .map((session) => ({
        ...session,
        exercises: exerciseRows.filter((e) => e.sessionId === session.id),
      })),
  }));
}

export async function getPhaseById(phaseId: string) {
  const all = await getAllPhasesWithSessions();
  return all.find((p) => p.id === phaseId) ?? null;
}

export function getCurrentPhase<T extends { startDate: string; endDate: string }>(
  allPhases: T[],
  todayISO: string = todayManilaISO()
): T | null {
  return allPhases.find((p) => todayISO >= p.startDate && todayISO <= p.endDate) ?? null;
}

export async function getWeighIns(limit = 90) {
  return db.select().from(weighIns).orderBy(desc(weighIns.date)).limit(limit);
}

export async function getLatestWeighIn() {
  const rows = await getWeighIns(1);
  return rows[0] ?? null;
}

export async function getCmjTests(limit = 20) {
  return db.select().from(cmjTests).orderBy(desc(cmjTests.date)).limit(limit);
}

export async function getJumpTests(type?: "broad_jump" | "seated_box", limit = 50) {
  const rows = await db.select().from(jumpTests).orderBy(desc(jumpTests.date)).limit(limit);
  return type ? rows.filter((r) => r.type === type) : rows;
}

export async function getFoodLogsForDate(dateISO: string) {
  return db.select().from(foodLogs).where(eq(foodLogs.date, dateISO)).orderBy(asc(foodLogs.timeSlot));
}

export async function getFoodLogsSince(dateISO: string) {
  return db.select().from(foodLogs).where(gte(foodLogs.date, dateISO)).orderBy(desc(foodLogs.date));
}

export async function getWaterLogsForDate(dateISO: string) {
  return db.select().from(waterLogs).where(eq(waterLogs.date, dateISO));
}

export async function getWaterLogsSince(dateISO: string) {
  return db.select().from(waterLogs).where(gte(waterLogs.date, dateISO)).orderBy(desc(waterLogs.date));
}

export async function getSleepLogs(limit = 30) {
  return db.select().from(sleepLogs).orderBy(desc(sleepLogs.date)).limit(limit);
}

export async function getSorenessLogs(limit = 30) {
  return db.select().from(sorenessLogs).orderBy(desc(sorenessLogs.date)).limit(limit);
}

export async function getWorkoutLogsSince(dateISO: string) {
  return db.select().from(workoutLogs).where(gte(workoutLogs.date, dateISO)).orderBy(desc(workoutLogs.date));
}

export async function getWorkoutLogsForExercise(exerciseId: number, limit = 30) {
  return db
    .select()
    .from(workoutLogs)
    .where(eq(workoutLogs.exerciseId, exerciseId))
    .orderBy(desc(workoutLogs.date))
    .limit(limit);
}

/** All sets from the most recent date this exercise was logged (empty if never). */
export async function getLastSessionSetsForExercise(exerciseId: number) {
  const rows = await getWorkoutLogsForExercise(exerciseId, 60);
  if (rows.length === 0) return [];
  const latestDate = rows[0].date;
  return rows.filter((r) => r.date === latestDate).sort((a, b) => a.setNumber - b.setNumber);
}

/** Today's logged sets for an exercise, in set order. */
export async function getTodaysSetsForExercise(exerciseId: number, todayISO: string) {
  const rows = await getWorkoutLogsForExercise(exerciseId, 30);
  return rows.filter((r) => r.date === todayISO).sort((a, b) => a.setNumber - b.setNumber);
}

export async function getSwimTimes(limit = 100) {
  return db.select().from(swimTimes).orderBy(desc(swimTimes.date)).limit(limit);
}

export async function getTimeTo15mLogs(limit = 50) {
  return db.select().from(timeTo15m).orderBy(desc(timeTo15m.date)).limit(limit);
}

/** 7-day rolling average bodyweight ending on the given date (inclusive). */
export async function getRecentWeighInsWindow(days: number) {
  const from = addDaysISO(todayManilaISO(), -days);
  return db.select().from(weighIns).where(gte(weighIns.date, from)).orderBy(asc(weighIns.date));
}
