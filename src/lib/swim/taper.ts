/**
 * Taper model (loop 37, E1 exactly): taper starts 11 days out (midpoint of
 * the evidence-backed 8-14 day window), volume ramps linearly down to 50%
 * of baseline (midpoint of the 41-60% window) by race day, intensity and
 * session frequency held throughout. Replaces the old static TaperChecklist
 * copy with a live, computed plan.
 */

import { addDaysISO, mondayOf } from "@/lib/time";
import type { ZoneDistance } from "./zones";

export type TaperPlan = {
  daysOut: number;
  inTaper: boolean;
  phase: "pre-taper" | "taper" | "race-week" | "post";
  baselineWeeklyM: number;
  targetWeeklyM: number;
  volumeReductionPct: number;
  intensityRule: string;
  frequencyRule: string;
  thisWeekActualM: number | null;
  adherence: "on-plan" | "too-much-volume" | "too-little-intensity" | "unknown";
  note: string;
};

const TAPER_START_DAYS_OUT = 11; // midpoint of the 8-14 day window [strong -- Bosquet 2007]
const TARGET_REDUCTION_PCT = 50; // midpoint of the 41-60% reduction window [strong -- Bosquet 2007]

export const TAPER_INTENSITY_RULE =
  "Hold SP1/SP2 pace and session frequency — only volume comes down. Cutting intensity during taper is what loses the adaptation [strong — Bosquet 2007].";
export const TAPER_FREQUENCY_RULE = "Keep the same number of sessions per week as pre-taper — shorter sessions, not fewer of them.";

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function qualityShare(w: { totalM: number; zoneDistance: ZoneDistance } | undefined): number | null {
  if (!w || w.totalM <= 0) return null;
  const q = (w.zoneDistance.SP1 ?? 0) + (w.zoneDistance.SP2 ?? 0);
  return q / w.totalM;
}

export function buildTaperPlan(params: {
  todayISO: string;
  meetDateISO: string;
  weeklyVolume: { weekStart: string; totalM: number; zoneDistance: ZoneDistance }[];
}): TaperPlan {
  const { todayISO, meetDateISO, weeklyVolume } = params;
  const daysOut = daysBetweenISO(todayISO, meetDateISO);
  const sorted = [...weeklyVolume].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));

  const phase: TaperPlan["phase"] =
    daysOut < 0 ? "post" : daysOut <= 6 ? "race-week" : daysOut <= TAPER_START_DAYS_OUT ? "taper" : "pre-taper";
  const inTaper = phase === "taper" || phase === "race-week" || phase === "post";

  const taperStartISO = addDaysISO(meetDateISO, -TAPER_START_DAYS_OUT);
  const preTaperWeeks = sorted.filter((w) => w.weekStart < taperStartISO);
  const baselineWeeks = preTaperWeeks.slice(-4);
  const baselineWeeklyM =
    baselineWeeks.length > 0 ? Math.round(baselineWeeks.reduce((s, w) => s + w.totalM, 0) / baselineWeeks.length) : 0;

  const taperProgress = phase === "pre-taper" ? 0 : Math.min(1, Math.max(0, (TAPER_START_DAYS_OUT - daysOut) / TAPER_START_DAYS_OUT));
  const volumeReductionPct = Math.round(taperProgress * TARGET_REDUCTION_PCT);
  const targetWeeklyM = Math.round(baselineWeeklyM * (1 - volumeReductionPct / 100));

  const thisWeek = sorted.find((w) => w.weekStart === mondayOf(todayISO));
  const thisWeekActualM = thisWeek ? thisWeek.totalM : null;

  const baselineQualityShares = baselineWeeks.map(qualityShare).filter((q): q is number => q !== null);
  const baselineQualityShare =
    baselineQualityShares.length > 0 ? baselineQualityShares.reduce((a, b) => a + b, 0) / baselineQualityShares.length : null;
  const thisWeekQualityShare = qualityShare(thisWeek);

  let adherence: TaperPlan["adherence"] = "unknown";
  if (inTaper && baselineWeeklyM > 0 && thisWeekActualM !== null) {
    if (thisWeekActualM > targetWeeklyM * 1.15) {
      adherence = "too-much-volume";
    } else if (baselineQualityShare !== null && baselineQualityShare > 0 && thisWeekQualityShare !== null && thisWeekQualityShare < baselineQualityShare * 0.7) {
      adherence = "too-little-intensity";
    } else {
      adherence = "on-plan";
    }
  }

  const note =
    baselineWeeklyM === 0
      ? "Not enough logged swim volume yet to set a taper baseline — needs 4 weeks of zone-tagged sessions before the meet's taper window."
      : phase === "pre-taper"
        ? `Taper hasn't started yet — begins ${TAPER_START_DAYS_OUT} days out. Baseline is ${baselineWeeklyM.toLocaleString()}m/week.`
        : `${volumeReductionPct}% down from your ${baselineWeeklyM.toLocaleString()}m/week baseline — target ${targetWeeklyM.toLocaleString()}m this week.`;

  return {
    daysOut,
    inTaper,
    phase,
    baselineWeeklyM,
    targetWeeklyM,
    volumeReductionPct,
    intensityRule: TAPER_INTENSITY_RULE,
    frequencyRule: TAPER_FREQUENCY_RULE,
    thisWeekActualM,
    adherence,
    note,
  };
}
