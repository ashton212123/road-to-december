/**
 * Adaptive energy target (loop 38, replaces the fixed 3,300-3,500 kcal band
 * that never adapted past the bulk window). The controller is the measured
 * weight response, not a TDEE formula -- individual TDEE estimates carry
 * ~20% error; his own 14-day weight trend against the phase's target rate
 * is the higher-quality signal.
 */

import { sevenDayAverage } from "./targets";

export type EnergyPhase = "gain" | "maintain" | "sharpen";

export type EnergyTarget = {
  kcal: number;
  low: number;
  high: number;
  phase: EnergyPhase;
  basis: "weight-response" | "estimate" | "override";
  rationale: string;
  confidence: "high" | "medium" | "low";
  weightTrendKgPerWk: number | null;
  targetRateKgPerWk: number;
};

const TARGET_RATE_KG_PER_WK: Record<EnergyPhase, number> = { gain: 0.28, maintain: 0.0, sharpen: -0.2 };
const PHASE_ADJUSTMENT_KCAL: Record<EnergyPhase, number> = { gain: 350, maintain: 0, sharpen: -300 };
const KCAL_PER_KG = 1100; // energy-equivalent of 1kg bodyweight change, used to convert a rate gap into a daily kcal correction

function schofieldEstimate(kg: number, phase: EnergyPhase): number {
  const bmr = 17.686 * kg + 658.2; // Schofield 15-18y male
  const pal = bmr * 2.1; // 9 swims + 3 lifts ~= 15-18h/wk
  return Math.round(pal + PHASE_ADJUSTMENT_KCAL[phase]);
}

/** Linear trend (kg/week) through a weigh-in window -- same least-squares
 * shape as the swim readiness regression, just for bodyweight over days. */
function weightTrendKgPerWeek(weighIns: { date: string; kg: number }[]): number | null {
  if (weighIns.length < 2) return null;
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const firstDate = sorted[0].date;
  const toDays = (iso: string) => (new Date(`${iso}T00:00:00Z`).getTime() - new Date(`${firstDate}T00:00:00Z`).getTime()) / 86_400_000;
  const xs = sorted.map((w) => toDays(w.date));
  const ys = sorted.map((w) => w.kg);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let ssXY = 0;
  let ssXX = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (xs[i] - meanX) * (ys[i] - meanY);
    ssXX += (xs[i] - meanX) ** 2;
  }
  const slopePerDay = ssXX === 0 ? 0 : ssXY / ssXX;
  return slopePerDay * 7;
}

export function computeEnergyTarget(params: {
  todayISO: string;
  energyPhase: EnergyPhase;
  kcalTargetOverride: number | null;
  weighIns: { date: string; kg: number }[];
  recentKcal: { date: string; kcal: number }[];
}): EnergyTarget {
  const { energyPhase, kcalTargetOverride, weighIns } = params;
  const targetRateKgPerWk = TARGET_RATE_KG_PER_WK[energyPhase];

  if (kcalTargetOverride !== null) {
    return {
      kcal: kcalTargetOverride,
      low: kcalTargetOverride - 150,
      high: kcalTargetOverride + 150,
      phase: energyPhase,
      basis: "override",
      rationale: `Manually set to ${kcalTargetOverride.toLocaleString()} kcal in Settings.`,
      confidence: "high",
      weightTrendKgPerWk: weightTrendKgPerWeek(weighIns),
      targetRateKgPerWk,
    };
  }

  // 14-day windows for both the weight trend and the observed-intake average
  // they're compared against, so the two numbers describe the same period.
  const windowStart = new Date(`${params.todayISO}T00:00:00Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - 13);
  const windowStartISO = windowStart.toISOString().slice(0, 10);
  const weighInsInWindow = weighIns.filter((w) => w.date >= windowStartISO);
  const kcalInWindow = params.recentKcal.filter((k) => k.date >= windowStartISO);

  if (weighInsInWindow.length < 14) {
    const avgKg = sevenDayAverage(weighIns.map((w) => ({ date: w.date, kg: w.kg }))) ?? 63;
    const kcal = schofieldEstimate(avgKg, energyPhase);
    return {
      kcal,
      low: kcal - 150,
      high: kcal + 150,
      phase: energyPhase,
      basis: "estimate",
      rationale: `Not enough weigh-in history yet (needs 14 days) -- seeded from a Schofield BMR estimate at ${avgKg.toFixed(1)}kg. This number will self-correct to your actual weight response once you've logged more weigh-ins.`,
      confidence: "low",
      weightTrendKgPerWk: weightTrendKgPerWeek(weighIns),
      targetRateKgPerWk,
    };
  }

  const observedRateKgPerWk = weightTrendKgPerWeek(weighInsInWindow) ?? 0;
  const avgKcal = kcalInWindow.length > 0 ? kcalInWindow.reduce((s, k) => s + k.kcal, 0) / kcalInWindow.length : schofieldEstimate(63, energyPhase);

  const rateDeltaKgPerWk = targetRateKgPerWk - observedRateKgPerWk;
  const rawAdjustment = (rateDeltaKgPerWk * KCAL_PER_KG) / 7;
  const adjustment = Math.max(-400, Math.min(400, rawAdjustment));
  const kcal = Math.round((avgKcal + adjustment) / 25) * 25;

  const daysOfData = weighInsInWindow.length;
  const confidence: EnergyTarget["confidence"] = daysOfData >= 21 ? "high" : "medium";

  const rateWord = observedRateKgPerWk >= 0 ? "gaining" : "losing";
  const rationale = `You're ${rateWord} ${Math.abs(observedRateKgPerWk).toFixed(2)} kg/wk on ~${Math.round(avgKcal).toLocaleString()} kcal. Target is ${targetRateKgPerWk >= 0 ? "+" : ""}${targetRateKgPerWk.toFixed(2)} -- that's about ${adjustment >= 0 ? "+" : ""}${Math.round(adjustment)} kcal/day.`;

  return {
    kcal,
    low: kcal - 150,
    high: kcal + 150,
    phase: energyPhase,
    basis: "weight-response",
    rationale,
    confidence,
    weightTrendKgPerWk: observedRateKgPerWk,
    targetRateKgPerWk,
  };
}

/** Phase auto-advance from the season calendar (loop 38's direct answer to
 * "will my fuel plan change automatically when my bulk phase is gone?"):
 * gain through the bulk window, maintain until 21 days before the first
 * target meet, sharpen inside that window -- unless overridden in Settings. */
export function computeAutoEnergyPhase(params: { todayISO: string; bulkWindowEndISO: string; firstMeetDateISO: string | null }): EnergyPhase {
  const { todayISO, bulkWindowEndISO, firstMeetDateISO } = params;
  if (todayISO <= bulkWindowEndISO) return "gain";
  if (firstMeetDateISO) {
    const meet = new Date(`${firstMeetDateISO}T00:00:00Z`).getTime();
    const today = new Date(`${todayISO}T00:00:00Z`).getTime();
    const daysToMeet = Math.round((meet - today) / 86_400_000);
    if (daysToMeet <= 21) return "sharpen";
  }
  return "maintain";
}

/** Human-readable "what changes and when" for the Fuel Plan tab's current-
 * phase card -- the direct answer to "will my fuel plan change automatically
 * when my bulk phase is gone?" */
export function describePhaseTransition(params: {
  todayISO: string;
  phase: EnergyPhase;
  bulkWindowEndISO: string;
  nextMeetDateISO: string | null;
}): { daysLeft: number | null; explainer: string } {
  const { todayISO, phase, bulkWindowEndISO, nextMeetDateISO } = params;
  const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
  const dateLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  if (phase === "gain") {
    const daysLeft = daysBetween(todayISO, bulkWindowEndISO);
    return { daysLeft, explainer: `Gain phase ends ${dateLabel(bulkWindowEndISO)} — targets move to maintenance automatically.` };
  }
  if (phase === "maintain") {
    if (nextMeetDateISO) {
      const sharpenStartISO = new Date(new Date(`${nextMeetDateISO}T00:00:00Z`).getTime() - 21 * 86_400_000).toISOString().slice(0, 10);
      const daysLeft = daysBetween(todayISO, sharpenStartISO);
      return {
        daysLeft: daysLeft >= 0 ? daysLeft : null,
        explainer: `Maintenance until 21 days before your next meet (${dateLabel(nextMeetDateISO)}) — then targets sharpen automatically.`,
      };
    }
    return { daysLeft: null, explainer: "Maintenance phase — targets will sharpen automatically 21 days before your next scheduled meet." };
  }
  if (nextMeetDateISO) {
    const daysLeft = daysBetween(todayISO, nextMeetDateISO);
    return { daysLeft, explainer: `Sharpen phase through your meet on ${dateLabel(nextMeetDateISO)} — volume comes down, targets stay tuned for taper.` };
  }
  return { daysLeft: null, explainer: "Sharpen phase — fine-tuning targets heading into your meet." };
}
