"use server";

import { revalidatePath, updateTag } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workoutLogs, swimSessions, swimTimes } from "@/lib/db/schema";
import type { SwimSessionInterval } from "@/lib/db/schema";
import { todayManilaISO } from "@/lib/time";
import { parseTrainingSession, type ParseSessionResult } from "@/lib/train/importSession";
import { isStravaConfigured, sendManualActivityToStrava } from "@/lib/integrations/strava";

/** One Groq call, reviewed client-side before anything saves -- same trust
 * pattern as meal quick log. Returns null on any failure; the caller keeps
 * the pasted text and offers manual logging instead of an error state. */
export async function estimateSessionImportAction(text: string): Promise<ParseSessionResult | null> {
  if (!text.trim()) return null;
  return parseTrainingSession(text);
}

export async function saveSwimSessionImportAction(input: {
  date?: string;
  loadRating: number;
  setsText: string;
  intervals: SwimSessionInterval[];
  totalDistanceM: number;
  notable: { event: string; timeMs: number }[];
}) {
  const date = input.date ?? todayManilaISO();

  await db.insert(swimSessions).values({
    date,
    loadRating: input.loadRating,
    setsText: input.setsText,
    // Exact, computed from the structured intervals themselves (reps x
    // distance summed) -- not re-derived via the regex-based estimator the
    // manual free-text logger uses, which would be strictly lossier here.
    parsedDistanceM: input.totalDistanceM,
    intervals: input.intervals,
  });

  if (input.notable.length > 0) {
    await db.insert(swimTimes).values(input.notable.map((n) => ({ date, event: n.event, timeMs: n.timeMs })));
  }

  revalidatePath("/train");
  revalidatePath("/analytics");
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

/** Sets are pre-matched to real exercise ids client-side (fuzzy-matched
 * against today's session, user-confirmed/retargeted) -- unmatched rows are
 * simply not included here, never inserted against a guessed id. Set
 * numbers continue from whatever's already logged today per exercise, same
 * as the MCP log_gym_session tool. */
export async function saveGymSessionImportAction(input: {
  phaseId: string;
  sets: { exerciseId: number; weightKg: number | null; reps: number | null; rpe: number | null }[];
}) {
  if (input.sets.length === 0) return;
  const today = todayManilaISO();
  const setNumberByExerciseId = new Map<number, number>();

  for (const s of input.sets) {
    if (!setNumberByExerciseId.has(s.exerciseId)) {
      const existing = await db
        .select()
        .from(workoutLogs)
        .where(and(eq(workoutLogs.exerciseId, s.exerciseId), eq(workoutLogs.date, today)));
      setNumberByExerciseId.set(s.exerciseId, existing.length);
    }
    const setNumber = setNumberByExerciseId.get(s.exerciseId)! + 1;
    setNumberByExerciseId.set(s.exerciseId, setNumber);
    await db.insert(workoutLogs).values({
      date: today,
      exerciseId: s.exerciseId,
      setNumber,
      weightKg: s.weightKg !== null ? String(s.weightKg) : null,
      reps: s.reps,
      rpe: s.rpe !== null ? String(s.rpe) : null,
    });
  }

  revalidatePath(`/train/${input.phaseId}`);
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

/** Whether the "Send to Strava" button should render at all -- absent env
 * vars means it never appears, no errors, no nags. */
export async function checkStravaConfiguredAction(): Promise<boolean> {
  return isStravaConfigured();
}

export async function sendSessionToStravaAction(input: {
  kind: "swim" | "gym";
  setsText: string;
  loadRating?: number;
  elapsedMinutes: number;
}): Promise<boolean> {
  const today = todayManilaISO();
  const activityId = await sendManualActivityToStrava({
    name: input.kind === "swim" ? "Swim practice" : "Gym session",
    type: input.kind === "swim" ? "Swim" : "WeightTraining",
    description: input.setsText,
    startDateLocalISO: `${today}T06:00:00`,
    elapsedSeconds: Math.round(input.elapsedMinutes * 60),
  });
  return activityId !== null;
}
