import { db } from "@/lib/db";
import { knowledge } from "@/lib/db/schema";
import { todayManilaISO, todayDayKey } from "@/lib/time";
import {
  getAllPhasesWithSessions,
  getCurrentPhase,
  getLatestWeighIn,
  getFoodLogsForDate,
  getFoodLogsSince,
  getWaterLogsForDate,
  getSettingsRow,
  getWorkoutLogsSince,
  getAllMeetsWithEvents,
  getSwimTimes,
  getWeighIns,
} from "@/lib/db/queries";
import { computeProteinTargetG } from "@/lib/fuel/targets";
import { computeEnergyTarget, computeAutoEnergyPhase } from "@/lib/fuel/energyModel";
import { seasonData } from "@/lib/data/season-data";
import { computeConsistencyPct } from "@/lib/analytics/streak";
import { computeMeetReadiness } from "@/lib/swim/readiness";
import { addDaysISO } from "@/lib/time";
import { getAthleteModel } from "@/lib/coach/athleteModel";
import { withFallback } from "@/lib/db/withFallback";

const KNOWLEDGE_STOPWORDS = new Set(["this", "that", "with", "have", "what", "when", "your", "about", "from", "just"]);

function scoreNote(note: { title: string; content: string }, queryWords: string[]): number {
  const text = (note.title + " " + note.content).toLowerCase();
  return queryWords.reduce((score, w) => score + (text.includes(w) ? 1 : 0), 0);
}

/** Simple keyword/title/recency retrieval over the synced vault -- no embeddings, appropriate for a single user's ~15-note include-list. */
export async function retrieveRelevantNotes(query: string, limit = 4) {
  const words = query
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3 && !KNOWLEDGE_STOPWORDS.has(w));
  const all = await db.select().from(knowledge);
  if (all.length === 0) return [];

  if (words.length === 0) {
    return [...all].sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime()).slice(0, limit);
  }
  const scored = all
    .map((note) => ({ note, score: scoreNote(note, words) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length > 0) return scored.slice(0, limit).map((s) => s.note);

  return [...all].sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime()).slice(0, limit);
}

export const FALLBACK_SETTINGS = {
  id: "singleton",
  aseanConfirmed: null,
  waterTargetMl: 3000,
  weightUnit: "kg" as const,
  trainingStatus: "healthy" as const,
  trainingStatusSince: null,
  energyPhase: null,
  kcalTargetOverride: null,
  poolCourseDefault: "SCM" as const,
};

/** A compact snapshot of today's live training/nutrition/meet state, the same kind of data the MCP tools expose, assembled fresh for each chat turn. */
export async function getCoachAppContext() {
  const today = todayManilaISO();
  const todayKey = todayDayKey();

  const [allPhases, latestWeighIn, todaysFood, todaysWater, settingsRow, recentWorkoutLogs, meetsWithEvents, swimTimes, athleteModel, weighInHistory, recentFoodLogs] =
    await Promise.all([
      withFallback(getAllPhasesWithSessions(), []),
      withFallback(getLatestWeighIn(), null),
      withFallback(getFoodLogsForDate(today), []),
      withFallback(getWaterLogsForDate(today), []),
      withFallback(getSettingsRow(), FALLBACK_SETTINGS),
      withFallback(getWorkoutLogsSince(addDaysISO(today, -150)), []),
      withFallback(getAllMeetsWithEvents(), []),
      withFallback(getSwimTimes(50), []),
      withFallback(getAthleteModel(), null),
      withFallback(getWeighIns(21), []),
      withFallback(getFoodLogsSince(addDaysISO(today, -13)), []),
    ]);

  const currentPhase = getCurrentPhase(allPhases, today) ?? allPhases[0];
  const todaySession = currentPhase?.sessions.find((s) => s.dayKey === todayKey) ?? null;
  const consistency = computeConsistencyPct({
    today,
    phases: allPhases,
    loggedDates: new Set(recentWorkoutLogs.map((l) => l.date)),
    excusedFromISO: settingsRow.trainingStatus === "healthy" ? null : settingsRow.trainingStatusSince,
  });
  const nextMeetDateForEnergy = meetsWithEvents.filter((m) => m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0]?.date ?? null;
  const energyPhase =
    settingsRow.energyPhase ??
    computeAutoEnergyPhase({ todayISO: today, bulkWindowEndISO: seasonData.meta.bulkWindowEnd, firstMeetDateISO: nextMeetDateForEnergy });
  const recentKcalByDate = new Map<string, number>();
  for (const f of recentFoodLogs) recentKcalByDate.set(f.date, (recentKcalByDate.get(f.date) ?? 0) + f.kcal);
  const kcalTarget = computeEnergyTarget({
    todayISO: today,
    energyPhase,
    kcalTargetOverride: settingsRow.kcalTargetOverride,
    weighIns: weighInHistory.map((w) => ({ date: w.date, kg: Number(w.kg) })),
    recentKcal: [...recentKcalByDate.entries()].map(([date, kcal]) => ({ date, kcal })),
  });
  const proteinTarget = computeProteinTargetG(latestWeighIn ? Number(latestWeighIn.kg) : 63);
  const kcalToday = todaysFood.reduce((s, f) => s + f.kcal, 0);
  const proteinToday = todaysFood.reduce((s, f) => s + Number(f.proteinG), 0);
  const waterToday = todaysWater.reduce((s, w) => s + w.ml, 0);

  const upcomingMeets = meetsWithEvents
    .filter((m) => m.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, 2)
    .map((meet) => {
      const targetCourse = meet.course ?? "LCM";
      return {
        name: meet.name,
        date: meet.date,
        course: meet.course,
        events: meet.events.map((ev) => {
          const loggedTimes = swimTimes
            .filter((s) => s.event === ev.event)
            .map((s) => ({ date: s.date, timeMs: s.timeMs, isRace: s.isPb || s.meetName !== null, course: s.course }));
          const readiness = computeMeetReadiness({ event: ev.event, targetTimeMs: ev.targetTimeMs, loggedTimes, meetDate: meet.date, today, targetCourse });
          // Explicit raceBest/practiceBest keys so the LLM can't conflate the two series.
          const { currentBestMs, practiceBestMs, practiceTrendMsPerWeek, ...rest } = readiness;
          return {
            event: ev.event,
            targetTimeMs: ev.targetTimeMs,
            raceBestMs: currentBestMs,
            practiceBestMs,
            practiceTrendMsPerWeek,
            ...rest,
          };
        }),
      };
    });

  return {
    today,
    athleteModel,
    phase: currentPhase ? `${currentPhase.tag} · ${currentPhase.name}` : null,
    todaySessionTitle: todaySession?.title ?? null,
    consistencyPct: consistency.pct,
    trainingStatus: settingsRow.trainingStatus,
    trainingStatusSince: settingsRow.trainingStatusSince,
    weightKg: latestWeighIn ? Number(latestWeighIn.kg) : null,
    kcalToday,
    kcalTarget: [kcalTarget.low, kcalTarget.high],
    kcalTargetRationale: kcalTarget.rationale,
    proteinTodayG: Math.round(proteinToday),
    proteinTargetMinG: proteinTarget.min,
    waterTodayMl: waterToday,
    waterTargetMl: settingsRow.waterTargetMl,
    upcomingMeets,
  };
}
