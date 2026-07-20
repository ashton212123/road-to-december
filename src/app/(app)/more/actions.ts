"use server";

import { revalidatePath, updateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { sleepLogs, sorenessLogs, settings, cmjTests, jumpTests } from "@/lib/db/schema";
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
