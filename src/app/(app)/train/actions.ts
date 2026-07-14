"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
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
  phaseId: string;
}) {
  await db
    .update(workoutLogs)
    .set({
      weightKg: input.weightKg !== null ? String(input.weightKg) : null,
      reps: input.reps,
      rpe: input.rpe !== null ? String(input.rpe) : null,
    })
    .where(eq(workoutLogs.id, input.logId));
  revalidatePath(`/train/${input.phaseId}`);
}
