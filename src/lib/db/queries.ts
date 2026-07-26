import { and, asc, desc, eq, gte, lte, ilike, inArray, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
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
  businesses,
  businessTransactions,
  businessTasks,
  businessNotes,
  meets,
  meetEvents,
  swimSessions,
  learnProgress,
} from "./schema";
import { todayManilaISO, addDaysISO } from "../time";
import { seasonData } from "../data/season-data";

export async function getLearnProgress() {
  return db.select().from(learnProgress);
}

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
      trainingStatus: "healthy",
    })
    .returning();
  return created;
}

// The 21-week program structure (phases/sessions/exercises) changes only when
// a coach edits it via the seed script -- essentially never at runtime. Every
// major page hits this (Home, Train, Fuel, Analytics, MCP), so caching it cuts
// 3 DB round-trips per page load across the whole app, which meaningfully
// reduces connection pressure on the database (see DECISIONS.md -- undersized
// free-tier compute is the real bottleneck, not a code bug).
export const getAllPhasesWithSessions = unstable_cache(
  async function getAllPhasesWithSessionsUncached() {
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
  },
  ["all-phases-with-sessions"],
  { revalidate: 300 }
);

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

/** Frequency-sorted distinct meals logged since `dateISO`, for Quick Log's "recent foods" chips. */
export async function getRecentFoodChips(dateISO: string, limit = 6) {
  return db
    .select({
      description: foodLogs.description,
      timeSlot: foodLogs.timeSlot,
      kcal: foodLogs.kcal,
      proteinG: foodLogs.proteinG,
      carbsG: foodLogs.carbsG,
      fatG: foodLogs.fatG,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(foodLogs)
    .where(gte(foodLogs.date, dateISO))
    .groupBy(foodLogs.description, foodLogs.timeSlot, foodLogs.kcal, foodLogs.proteinG, foodLogs.carbsG, foodLogs.fatG)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
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


/**
 * Today's sets + each exercise's last-logged-session sets, for every exercise
 * in a session, in exactly 2 queries total regardless of exercise count --
 * replaces the old per-exercise N+1 loop (was 2 queries × N exercises).
 */
export async function getSessionWorkoutData(exerciseIds: number[], todayISO: string) {
  type Row = typeof workoutLogs.$inferSelect;
  const empty = { todaysByExercise: new Map<number, Row[]>(), lastSessionByExercise: new Map<number, Row[]>() };
  if (exerciseIds.length === 0) return empty;

  const [todaysRows, recentRows] = await Promise.all([
    db
      .select()
      .from(workoutLogs)
      .where(and(inArray(workoutLogs.exerciseId, exerciseIds), eq(workoutLogs.date, todayISO)))
      .orderBy(asc(workoutLogs.setNumber)),
    // Bounded window across all exercises in one query -- last-session lookup
    // just needs each exercise's most recent logged date, not full history.
    db
      .select()
      .from(workoutLogs)
      .where(inArray(workoutLogs.exerciseId, exerciseIds))
      .orderBy(desc(workoutLogs.date))
      .limit(exerciseIds.length * 20),
  ]);

  const todaysByExercise = new Map<number, Row[]>();
  for (const row of todaysRows) {
    if (!todaysByExercise.has(row.exerciseId)) todaysByExercise.set(row.exerciseId, []);
    todaysByExercise.get(row.exerciseId)!.push(row);
  }

  const latestDateByExercise = new Map<number, string>();
  for (const row of recentRows) {
    if (row.date === todayISO) continue;
    const cur = latestDateByExercise.get(row.exerciseId);
    if (!cur || row.date > cur) latestDateByExercise.set(row.exerciseId, row.date);
  }
  const lastSessionByExercise = new Map<number, Row[]>();
  for (const row of recentRows) {
    if (row.date !== latestDateByExercise.get(row.exerciseId)) continue;
    if (!lastSessionByExercise.has(row.exerciseId)) lastSessionByExercise.set(row.exerciseId, []);
    lastSessionByExercise.get(row.exerciseId)!.push(row);
  }
  for (const rows of lastSessionByExercise.values()) rows.sort((a, b) => a.setNumber - b.setNumber);

  return { todaysByExercise, lastSessionByExercise };
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

/** Workout logs joined with their exercise (name, movement pattern, main-lift flag). */
export async function getWorkoutLogsWithExerciseSince(dateISO: string) {
  const rows = await db
    .select({
      id: workoutLogs.id,
      date: workoutLogs.date,
      setNumber: workoutLogs.setNumber,
      weightKg: workoutLogs.weightKg,
      reps: workoutLogs.reps,
      rpe: workoutLogs.rpe,
      createdAt: workoutLogs.createdAt,
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      movementPattern: exercises.movementPattern,
      isMainLift: exercises.isMainLift,
    })
    .from(workoutLogs)
    .innerJoin(exercises, eq(workoutLogs.exerciseId, exercises.id))
    .where(gte(workoutLogs.date, dateISO))
    .orderBy(asc(workoutLogs.date));
  return rows;
}

/** Best-set e1RM history per named main lift (for Home's training-load chart
 * and PR detection). Bounded to ~13 months, not truly unbounded -- an
 * unbounded join here was a real slow-query risk as workout_logs grows, and
 * neither training load (needs ~8 weeks) nor PR detection (meaningfully
 * "recent") benefit from scanning further back than that. */
export async function getMainLiftLogHistory() {
  return getWorkoutLogsWithExerciseSince(addDaysISO(todayManilaISO(), -400)).then((rows) => rows.filter((r) => r.isMainLift));
}

export async function getBusinesses() {
  return db.select().from(businesses).orderBy(asc(businesses.archived), asc(businesses.name));
}

export async function getBusinessById(businessId: number) {
  const rows = await db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  return rows[0] ?? null;
}

export async function getBusinessTransactions(businessId: number, limit = 200) {
  return db
    .select()
    .from(businessTransactions)
    .where(eq(businessTransactions.businessId, businessId))
    .orderBy(desc(businessTransactions.date), desc(businessTransactions.id))
    .limit(limit);
}

export async function getAllBusinessTransactions(limit = 500) {
  return db.select().from(businessTransactions).orderBy(desc(businessTransactions.date)).limit(limit);
}

export async function getBusinessTasks(businessId: number) {
  return db
    .select()
    .from(businessTasks)
    .where(eq(businessTasks.businessId, businessId))
    .orderBy(asc(businessTasks.done), desc(businessTasks.createdAt));
}

export async function getBusinessNotes(businessId: number) {
  return db.select().from(businessNotes).where(eq(businessNotes.businessId, businessId)).orderBy(desc(businessNotes.createdAt));
}

/** Undone tasks across every non-archived venture, for the Home dashboard's merged priorities. */
export async function getUndoneBusinessTasks(limit = 10) {
  const rows = await db
    .select({
      id: businessTasks.id,
      title: businessTasks.title,
      dueDate: businessTasks.dueDate,
      businessId: businessTasks.businessId,
      businessName: businesses.name,
    })
    .from(businessTasks)
    .innerJoin(businesses, eq(businessTasks.businessId, businesses.id))
    .where(and(eq(businessTasks.done, false), eq(businesses.archived, false)))
    .orderBy(asc(businessTasks.dueDate))
    .limit(limit);
  return rows;
}

export async function getMeets() {
  return db.select().from(meets).orderBy(asc(meets.date));
}

export async function getMeetById(meetId: number) {
  const rows = await db.select().from(meets).where(eq(meets.id, meetId)).limit(1);
  return rows[0] ?? null;
}

export async function getMeetEvents(meetId: number) {
  return db.select().from(meetEvents).where(eq(meetEvents.meetId, meetId)).orderBy(asc(meetEvents.id));
}

/** One left-joined round trip instead of two sequential ones -- under this
 * pool's deliberately tiny `max: 3` (see lib/db/index.ts), a caller that
 * needs to re-acquire a connection mid-function competes against every
 * other concurrent query for the same 3 slots twice instead of once. In
 * getCoachAppContext's 9-way Promise.all this was enough to starve the
 * second query indefinitely rather than just queue it like the others --
 * found via per-query timing when the athlete-facing coach chat endpoint
 * was hanging past Vercel's 60s function cap with no error. */
export async function getAllMeetsWithEvents() {
  const rows = await db
    .select({ meet: meets, event: meetEvents })
    .from(meets)
    .leftJoin(meetEvents, eq(meetEvents.meetId, meets.id))
    .orderBy(asc(meets.date));

  const byMeetId = new Map<number, { id: number; name: string; date: string; createdAt: Date; events: (typeof meetEvents.$inferSelect)[] }>();
  for (const { meet, event } of rows) {
    if (!byMeetId.has(meet.id)) byMeetId.set(meet.id, { ...meet, events: [] });
    if (event) byMeetId.get(meet.id)!.events.push(event);
  }
  return [...byMeetId.values()];
}

export async function getSwimSessions(limit = 60) {
  return db.select().from(swimSessions).orderBy(desc(swimSessions.date)).limit(limit);
}

/** Date-bounded (not count-bounded) so the sessions-history page's "26
 * weeks" cap is an actual date window, not an arbitrary row count that could
 * cut a busy multi-session week in half. */
export async function getSwimSessionsSince(sinceISO: string) {
  return db.select().from(swimSessions).where(gte(swimSessions.date, sinceISO)).orderBy(desc(swimSessions.date));
}

export async function getSwimSessionById(id: number) {
  const rows = await db.select().from(swimSessions).where(eq(swimSessions.id, id)).limit(1);
  return rows[0] ?? null;
}

/** The week of sessions around a given date -- context for the detail page
 * (what came right before/after this one), never blended into the session's
 * own numbers. */
export async function getSwimSessionsNear(date: string, excludeId: number, days = 7) {
  const rows = await db
    .select({ id: swimSessions.id, date: swimSessions.date, sessionType: swimSessions.sessionType, parsedDistanceM: swimSessions.parsedDistanceM })
    .from(swimSessions)
    .where(and(gte(swimSessions.date, addDaysISO(date, -days)), lte(swimSessions.date, addDaysISO(date, days))))
    .orderBy(asc(swimSessions.date));
  return rows.filter((r) => r.id !== excludeId);
}

export async function resolveBusinessByName(name: string) {
  const matches = await db.select().from(businesses).where(ilike(businesses.name, `%${name}%`));
  return matches[0] ?? null;
}

export async function resolveBusinessTaskByTitle(businessId: number, title: string) {
  const matches = await db
    .select()
    .from(businessTasks)
    .where(and(eq(businessTasks.businessId, businessId), ilike(businessTasks.title, `%${title}%`)));
  return matches[0] ?? null;
}

/**
 * Resolves a free-text exercise name (as an MCP tool caller would type it,
 * e.g. "back squat") to a specific exercise row. Prefers a match inside
 * the currently active phase so "back squat" resolves to this week's
 * prescription rather than an identically-named entry from another phase.
 */
export async function resolveExerciseByName(name: string) {
  const matches = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      sessionId: exercises.sessionId,
      phaseId: sessions.phaseId,
    })
    .from(exercises)
    .innerJoin(sessions, eq(exercises.sessionId, sessions.id))
    .where(ilike(exercises.name, `%${name}%`));

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const allPhases = await getAllPhasesWithSessions();
  const currentPhase = getCurrentPhase(allPhases);
  const inCurrentPhase = currentPhase ? matches.find((m) => m.phaseId === currentPhase.id) : null;
  return inCurrentPhase ?? matches[0];
}
