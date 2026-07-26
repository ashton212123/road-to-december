"use server";

import { revalidatePath, updateTag } from "next/cache";
import { desc, gte, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { swimSessions, sessionLoads, meets, swimTimes } from "@/lib/db/schema";
import type { SwimSessionInterval } from "@/lib/db/schema";
import { todayManilaISO, addDaysISO } from "@/lib/time";
import { parseSwimSession, parseSwimTimeText, type AiSwimSession, type AiSwimTime } from "@/lib/swim/aiSession";
import type { Course } from "@/lib/swim/course";
import { classifySession } from "@/lib/swim/sessionType";
import type { ZoneDistance } from "@/lib/swim/zones";
import { computeCriticalSpeed } from "@/lib/swim/criticalSpeed";
import { generateSessionAnalysis } from "@/lib/swim/sessionAnalysis";

export async function analyzeSwimSessionAction(text: string): Promise<AiSwimSession | null> {
  if (!text.trim()) return null;
  return parseSwimSession(text);
}

export async function analyzeSwimTimeAction(text: string): Promise<AiSwimTime | null> {
  if (!text.trim()) return null;
  return parseSwimTimeText(text);
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
  const zoneDistance = input.zoneDistanceM as ZoneDistance;
  // Recomputed server-side (authoritative) from the same zone/total inputs
  // the client classified with -- never trusts input.sessionType directly.
  const classification = classifySession(zoneDistance, input.finalTotalDistanceM);

  // Sequential, not concurrent (pool max: 3) -- this action already runs 2-3
  // inserts after this, so three more round trips stay well under budget.
  const recentSessions = await db
    .select({ date: swimSessions.date, sessionType: swimSessions.sessionType })
    .from(swimSessions)
    .where(gte(swimSessions.date, addDaysISO(date, -7)))
    .orderBy(desc(swimSessions.date));
  const upcomingMeets = await db.select({ date: meets.date }).from(meets).where(gte(meets.date, date)).orderBy(asc(meets.date)).limit(1);
  const recentRaceTimes = await db
    .select({ event: swimTimes.event, timeMs: swimTimes.timeMs, course: swimTimes.course, meetName: swimTimes.meetName, isPb: swimTimes.isPb })
    .from(swimTimes)
    .orderBy(desc(swimTimes.date))
    .limit(50);

  const daysToNextMeet =
    upcomingMeets.length > 0
      ? Math.round((new Date(`${upcomingMeets[0].date}T00:00:00Z`).getTime() - new Date(`${date}T00:00:00Z`).getTime()) / 86_400_000)
      : null;
  const criticalSpeed = computeCriticalSpeed(
    recentRaceTimes
      .filter((t) => t.course !== null)
      .map((t) => ({ event: t.event, timeMs: t.timeMs, course: t.course as Course, isRace: t.isPb || t.meetName !== null }))
  );

  const aiAnalysis = await generateSessionAnalysis({
    classification,
    zoneDistance,
    totalM: input.finalTotalDistanceM,
    breastKickM: input.breastKickM,
    durationMin: input.durationMin,
    sessionRpe: input.sessionRpe,
    course: input.course,
    intervals: input.intervals,
    recentSessionTypes: recentSessions.filter((s) => s.sessionType !== null).map((s) => ({ date: s.date, type: s.sessionType as string })),
    daysToNextMeet,
    criticalSpeed,
  });

  const [session] = await db
    .insert(swimSessions)
    .values({
      date,
      loadRating: Math.round(input.sessionRpe),
      setsText: input.setsText,
      parsedDistanceM: input.finalTotalDistanceM,
      intervals: input.intervals,
      course: input.course,
      sessionType: classification.type,
      zoneDistanceM: input.zoneDistanceM,
      strokeDistanceM: input.strokeDistanceM,
      statedTotalDistanceM: input.statedTotalDistanceM,
      breastKickM: input.breastKickM,
      durationMin: input.durationMin,
      sessionRpe: String(input.sessionRpe),
      aiSummary: input.aiSummary,
      aiAnalysis,
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
