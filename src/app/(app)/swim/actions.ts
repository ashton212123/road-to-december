"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { swimSessions, sessionLoads } from "@/lib/db/schema";
import type { SwimSessionInterval } from "@/lib/db/schema";
import { todayManilaISO } from "@/lib/time";
import { parseSwimSession, type AiSwimSession } from "@/lib/swim/aiSession";
import type { Course } from "@/lib/swim/course";

export async function analyzeSwimSessionAction(text: string): Promise<AiSwimSession | null> {
  if (!text.trim()) return null;
  return parseSwimSession(text);
}

export async function saveSwimSessionAction(input: {
  date?: string;
  intervals: SwimSessionInterval[];
  zoneDistanceM: Record<string, number>;
  strokeDistanceM: Record<string, number>;
  statedTotalDistanceM: number | null;
  finalTotalDistanceM: number;
  breastKickM: number;
  sessionType: string;
  durationMin: number;
  sessionRpe: number;
  course: Course;
  setsText: string;
  aiSummary: string | null;
  notable: { event: string; timeMs: number; isRace: boolean }[];
}): Promise<void> {
  const date = input.date ?? todayManilaISO();

  const [session] = await db
    .insert(swimSessions)
    .values({
      date,
      loadRating: Math.round(input.sessionRpe),
      setsText: input.setsText,
      parsedDistanceM: input.finalTotalDistanceM,
      intervals: input.intervals,
      course: input.course,
      sessionType: input.sessionType,
      zoneDistanceM: input.zoneDistanceM,
      strokeDistanceM: input.strokeDistanceM,
      statedTotalDistanceM: input.statedTotalDistanceM,
      breastKickM: input.breastKickM,
      durationMin: input.durationMin,
      sessionRpe: String(input.sessionRpe),
      aiSummary: input.aiSummary,
    })
    .returning();

  await db
    .insert(sessionLoads)
    .values({
      date,
      kind: "swim",
      sourceId: session.id,
      rpe: String(input.sessionRpe),
      durationMin: input.durationMin,
      load: Math.round(input.sessionRpe * input.durationMin),
    })
    .onConflictDoNothing();

  if (input.notable.length > 0) {
    const { swimTimes } = await import("@/lib/db/schema");
    await db.insert(swimTimes).values(
      input.notable.map((n) => ({
        date,
        event: n.event,
        timeMs: n.timeMs,
        course: input.course,
        meetName: n.isRace ? "Time trial" : null,
      }))
    );
  }

  revalidatePath("/swim");
  revalidatePath("/home");
  revalidatePath("/analytics");
  updateTag("analytics-data");
  updateTag("home-data");
}
