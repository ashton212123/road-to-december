"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { workoutLogs } from "@/lib/db/schema";
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
}

export async function deleteSetAction(logId: number, phaseId: string) {
  await db.delete(workoutLogs).where(eq(workoutLogs.id, logId));
  revalidatePath(`/train/${phaseId}`);
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
}

/** Checkbox-first logging: marks an exercise done in one tap by logging every
 * prescribed set with sensible defaults (prescribed reps, last session's top
 * weight). Weight/reps/notes stay editable afterward via the detail view. */
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
  revalidatePath(`/train/${input.phaseId}`);
  revalidatePath("/home");
}

export async function uncompleteExerciseAction(exerciseId: number, phaseId: string) {
  const today = todayManilaISO();
  await db.delete(workoutLogs).where(and(eq(workoutLogs.exerciseId, exerciseId), eq(workoutLogs.date, today)));
  revalidatePath(`/train/${phaseId}`);
  revalidatePath("/home");
}
