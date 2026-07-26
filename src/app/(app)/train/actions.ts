"use server";

import { revalidatePath, updateTag } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workoutLogs, exercises, sessionLoads } from "@/lib/db/schema";
import { todayManilaISO } from "@/lib/time";

export async function logSetAction(input: {
  exerciseId: number;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  restSeconds: number | null;
  notes?: string | null;
  phaseId: string;
}) {
  await db.insert(workoutLogs).values({
    date: todayManilaISO(),
    exerciseId: input.exerciseId,
    setNumber: input.setNumber,
    weightKg: input.weightKg !== null ? String(input.weightKg) : null,
    reps: input.reps,
    rpe: input.rpe !== null ? String(input.rpe) : null,
    restSeconds: input.restSeconds,
    notes: input.notes ?? null,
  });
  revalidatePath(`/train/${input.phaseId}`);
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function deleteSetAction(logId: number, phaseId: string) {
  await db.delete(workoutLogs).where(eq(workoutLogs.id, logId));
  revalidatePath(`/train/${phaseId}`);
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function updateSetAction(input: {
  logId: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
  phaseId: string;
}) {
  await db
    .update(workoutLogs)
    .set({
      weightKg: input.weightKg !== null ? String(input.weightKg) : null,
      reps: input.reps,
      rpe: input.rpe !== null ? String(input.rpe) : null,
      notes: input.notes,
    })
    .where(eq(workoutLogs.id, input.logId));
  revalidatePath(`/train/${input.phaseId}`);
  updateTag("analytics-data");
  updateTag("home-data");
}

/** Checkbox-first logging: marks an exercise done in one tap by logging every
 * prescribed set with sensible defaults (prescribed reps, resolved default
 * weight from the fallback chain computed by the caller). Weight/reps/notes
 * stay editable afterward via the detail view. Never fabricates a weight --
 * `defaultWeightKg` is null exactly when there's truly no signal yet, and
 * that's a legitimate, silent outcome, not an error state. */
export async function completeExerciseAction(input: {
  exerciseId: number;
  phaseId: string;
  setCount: number;
  defaultReps: number | null;
  defaultWeightKg: number | null;
}) {
  const today = todayManilaISO();
  const setCount = Math.max(1, input.setCount);
  await db.insert(workoutLogs).values(
    Array.from({ length: setCount }, (_, i) => ({
      date: today,
      exerciseId: input.exerciseId,
      setNumber: i + 1,
      weightKg: input.defaultWeightKg !== null ? String(input.defaultWeightKg) : null,
      reps: input.defaultReps,
      rpe: null,
      restSeconds: null,
      notes: null,
    }))
  );
  // Learn this as the exercise's new working default so next time's
  // checkbox-complete starts from here instead of re-deriving from history.
  if (input.defaultWeightKg !== null) {
    await db
      .update(exercises)
      .set({ defaultWeightKg: String(input.defaultWeightKg) })
      .where(eq(exercises.id, input.exerciseId));
  }
  revalidatePath(`/train/${input.phaseId}`);
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function uncompleteExerciseAction(exerciseId: number, phaseId: string) {
  const today = todayManilaISO();
  await db.delete(workoutLogs).where(and(eq(workoutLogs.exerciseId, exerciseId), eq(workoutLogs.date, today)));
  revalidatePath(`/train/${phaseId}`);
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

/** Foster's session-RPE method: one whole-session RPE collected ~30 min
 * post-session, multiplied by actual duration -- the unified load signal
 * shared with swim (loop 32's session_loads table). Dismissing the prompt
 * without rating is allowed (called only when the athlete actually taps a
 * pill); onConflictDoNothing so a double-submit is a no-op. */
export async function logSessionRpeAction(input: { kind: "gym" | "swim"; rpe: number; durationMin: number }) {
  await db
    .insert(sessionLoads)
    .values({
      date: todayManilaISO(),
      kind: input.kind,
      sourceId: null,
      rpe: String(input.rpe),
      durationMin: input.durationMin,
      load: Math.round(input.rpe * input.durationMin),
    })
    .onConflictDoNothing();
  updateTag("analytics-data");
  updateTag("home-data");
}
