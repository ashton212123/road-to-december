"use server";

import { revalidatePath, updateTag } from "next/cache";
import { eq, lt, gt, desc, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { sleepLogs, sorenessLogs, settings, cmjTests, jumpTests, aiTakeaways, habits } from "@/lib/db/schema";
import type { Settings } from "@/lib/db/schema";
import { todayManilaISO } from "@/lib/time";

export async function logSleepAction(input: { hours: number; bedtime: string; onTime: boolean | null }) {
  await db.insert(sleepLogs).values({
    date: todayManilaISO(),
    hours: String(input.hours),
    bedtime: input.bedtime || null,
    onTime: input.onTime,
  });
  revalidatePath("/more/recovery");
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function logSorenessAction(rating: number, area: string) {
  await db.insert(sorenessLogs).values({ date: todayManilaISO(), rating1to5: rating, area });
  revalidatePath("/more/recovery");
  updateTag("analytics-data");
}

export async function logCmjAction(cm: number) {
  await db.insert(cmjTests).values({ date: todayManilaISO(), bestOf3Cm: String(cm) });
  revalidatePath("/more/recovery");
  revalidatePath("/analytics");
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function logJumpTestAction(type: "broad_jump" | "seated_box", cm: number) {
  await db.insert(jumpTests).values({ date: todayManilaISO(), type, valueCm: String(cm) });
  revalidatePath("/analytics");
  updateTag("analytics-data");
}

export async function updateSettingsAction(input: {
  aseanConfirmed: boolean | null;
  waterTargetMl: number;
  weightUnit: "kg" | "lb";
}) {
  await db
    .update(settings)
    .set({
      aseanConfirmed: input.aseanConfirmed,
      waterTargetMl: input.waterTargetMl,
      weightUnit: input.weightUnit,
    })
    .where(eq(settings.id, "singleton"));
  revalidatePath("/", "layout");
  updateTag("analytics-data");
  updateTag("home-data");
}

const ATHLETE_MODEL_KEY = "athlete-model";

/** Manual correction to the coach's persistent athlete model (see
 * lib/coach/athleteModel.ts). Unlike the daily auto-refresh, which uses
 * onConflictDoNothing (idempotent per day), a manual edit must win even if
 * today's row already exists -- onConflictDoUpdate overwrites it. Newest
 * date wins in getAthleteModel(), so this is immediately the live memory. */
export async function updateAthleteModelAction(message: string) {
  const trimmed = message.trim().slice(0, 900);
  if (!trimmed) return;
  await db
    .insert(aiTakeaways)
    .values({ date: todayManilaISO(), key: ATHLETE_MODEL_KEY, message: trimmed })
    .onConflictDoUpdate({
      target: [aiTakeaways.date, aiTakeaways.key],
      set: { message: trimmed },
    });
  revalidatePath("/more/settings");
}

export type TrainingStatus = Settings["trainingStatus"];

/** Gentler Streak-style status switch, reachable from Settings and Home's
 * avatar menu. trainingStatusSince stamps the day the athlete went
 * non-healthy so the week map/consistency %/coach brief can all reference
 * "since when" -- it clears back to null the moment status returns to
 * healthy, since "since" only means something for an excused stretch. */
export async function updateTrainingStatusAction(status: TrainingStatus) {
  await db
    .update(settings)
    .set({
      trainingStatus: status,
      trainingStatusSince: status === "healthy" ? null : todayManilaISO(),
    })
    .where(eq(settings.id, "singleton"));
  revalidatePath("/", "layout");
  updateTag("analytics-data");
  updateTag("home-data");
}

/** Habit editor (§4a "Settings gets a habit editor: add / rename / reorder /
 * archive habits and subtasks"). Kept in more/actions.ts alongside the rest
 * of Settings' server actions rather than a dedicated file, matching this
 * file's existing scope. */
export async function addHabitAction(name: string, category: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const [{ maxOrder }] = await db.select({ maxOrder: sql<number>`coalesce(max(${habits.sortOrder}), -1)` }).from(habits);
  await db.insert(habits).values({ name: trimmed, category, sortOrder: Number(maxOrder) + 1, subtasks: [] });
  revalidatePath("/more/settings");
  revalidatePath("/home");
  updateTag("home-data");
}

export async function renameHabitAction(id: number, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.update(habits).set({ name: trimmed }).where(eq(habits.id, id));
  revalidatePath("/more/settings");
  revalidatePath("/home");
  updateTag("home-data");
}

export async function updateHabitSubtasksAction(id: number, subtasks: { id: string; label: string }[]) {
  await db.update(habits).set({ subtasks }).where(eq(habits.id, id));
  revalidatePath("/more/settings");
  revalidatePath("/home");
  updateTag("home-data");
}

export async function setHabitActiveAction(id: number, active: boolean) {
  await db.update(habits).set({ active }).where(eq(habits.id, id));
  revalidatePath("/more/settings");
  revalidatePath("/home");
  updateTag("home-data");
}

export async function reorderHabitAction(id: number, direction: "up" | "down") {
  const [habit] = await db.select().from(habits).where(eq(habits.id, id));
  if (!habit) return;
  const neighbor = await db
    .select()
    .from(habits)
    .where(direction === "up" ? lt(habits.sortOrder, habit.sortOrder) : gt(habits.sortOrder, habit.sortOrder))
    .orderBy(direction === "up" ? desc(habits.sortOrder) : asc(habits.sortOrder))
    .limit(1);
  if (neighbor.length === 0) return;
  await db.update(habits).set({ sortOrder: neighbor[0].sortOrder }).where(eq(habits.id, habit.id));
  await db.update(habits).set({ sortOrder: habit.sortOrder }).where(eq(habits.id, neighbor[0].id));
  revalidatePath("/more/settings");
  revalidatePath("/home");
  updateTag("home-data");
}
