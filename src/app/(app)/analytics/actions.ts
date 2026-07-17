"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { swimTimes } from "@/lib/db/schema";
import { todayManilaISO } from "@/lib/time";

export async function logSwimTimeAction(input: {
  event: string;
  timeMs: number;
  meetName: string | null;
  splits: number[] | null;
  strokeCounts: number[] | null;
}) {
  await db.insert(swimTimes).values({
    date: todayManilaISO(),
    event: input.event,
    timeMs: input.timeMs,
    meetName: input.meetName,
    splits: input.splits,
    strokeCounts: input.strokeCounts,
  });
  revalidatePath("/analytics");
}

export async function deleteSwimTimeAction(id: number) {
  await db.delete(swimTimes).where(eq(swimTimes.id, id));
  revalidatePath("/analytics");
}
