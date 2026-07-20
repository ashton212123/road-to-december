"use server";

import { revalidatePath, updateTag } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { swimTimes, meets, meetEvents, swimSessions } from "@/lib/db/schema";
import { todayManilaISO } from "@/lib/time";
import { estimateDistanceM } from "@/lib/swim/parseSets";

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
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function deleteSwimTimeAction(id: number) {
  await db.delete(swimTimes).where(eq(swimTimes.id, id));
  revalidatePath("/analytics");
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function createMeetAction(input: {
  name: string;
  date: string;
  events: { event: string; currentTimeMs: number | null; targetTimeMs: number }[];
}) {
  const [meet] = await db.insert(meets).values({ name: input.name, date: input.date }).returning();
  if (input.events.length > 0) {
    await db.insert(meetEvents).values(
      input.events.map((e) => ({ meetId: meet.id, event: e.event, currentTimeMs: e.currentTimeMs, targetTimeMs: e.targetTimeMs }))
    );
  }
  revalidatePath("/analytics");
  updateTag("analytics-data");
  return meet;
}

export async function deleteMeetAction(meetId: number) {
  await db.delete(meets).where(eq(meets.id, meetId));
  revalidatePath("/analytics");
  updateTag("analytics-data");
}

export async function logSwimSessionAction(input: { loadRating: number; setsText: string | null; date?: string }) {
  await db.insert(swimSessions).values({
    date: input.date ?? todayManilaISO(),
    loadRating: input.loadRating,
    setsText: input.setsText,
    parsedDistanceM: input.setsText ? estimateDistanceM(input.setsText) : null,
  });
  revalidatePath("/analytics");
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function deleteSwimSessionAction(id: number) {
  await db.delete(swimSessions).where(eq(swimSessions.id, id));
  revalidatePath("/analytics");
  updateTag("analytics-data");
  updateTag("home-data");
}
