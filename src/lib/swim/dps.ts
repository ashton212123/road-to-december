/**
 * The breaststroke technique engine: distance-per-stroke (DPS) decay across
 * a race. The strongest, most actionable breaststroke finding in the
 * literature is that over a 100 BR, clean speed falls because stroke length
 * collapses while stroke rate holds (EVIDENCE.E2) -- this makes
 * DPS-decay-across-the-race the single most diagnostic number available
 * from data the athlete already logs (splits + stroke counts).
 */

import type { Course } from "./course";

export type LengthMetrics = { index: number; splitSec: number; strokes: number; dps: number; strokeRate: number | null };

export type DpsSignature = "length-collapse" | "rate-collapse" | "both" | "held" | "insufficient-data";

export type DpsAnalysis = {
  lengths: LengthMetrics[];
  dpsDecayPct: number | null; // last length vs first, % LOSS (positive = length collapsing)
  rateDeltaPct: number | null; // last vs first stroke rate
  signature: DpsSignature;
  interpretation: string;
};

const POOL_LENGTH_M: Record<Course, number> = { SCM: 25, LCM: 50 };

function buildInterpretation(signature: DpsSignature, dpsDecayPct: number | null, rateDeltaPct: number | null): string {
  switch (signature) {
    case "length-collapse": {
      const x = dpsDecayPct !== null ? Math.abs(dpsDecayPct).toFixed(0) : "?";
      return `Classic breaststroke fatigue signature: stroke rate held but distance-per-stroke fell ${x}%. In a 100 BR, clean speed drops through loss of stroke length, not rate [moderate]. The fix is force reserve and back-half length, not turning the arms over faster.`;
    }
    case "rate-collapse": {
      const x = rateDeltaPct !== null ? Math.abs(rateDeltaPct).toFixed(0) : "?";
      return `Stroke rate fell ${x}% while length held — this is a pacing/effort-distribution pattern, not a length problem. Check whether the first 50 was overspent.`;
    }
    case "both": {
      const dx = dpsDecayPct !== null ? Math.abs(dpsDecayPct).toFixed(0) : "?";
      const rx = rateDeltaPct !== null ? Math.abs(rateDeltaPct).toFixed(0) : "?";
      return `Both length (down ${dx}%) and rate (down ${rx}%) fell across the swim — a full fatigue collapse, not just a technical breakdown.`;
    }
    case "held":
      return "Length and rate both held across the swim. On this race, fatigue resistance was not the limiter.";
    default:
      return "Not enough data to analyse this swim.";
  }
}

export function analyzeDps(params: { event: string; course: Course; splits: number[]; strokeCounts: number[] }): DpsAnalysis {
  const { course, splits, strokeCounts } = params;

  if (splits.length === 0 || strokeCounts.length === 0 || splits.length !== strokeCounts.length) {
    const missing =
      splits.length !== strokeCounts.length && splits.length > 0
        ? `needs stroke counts for all ${splits.length} lengths`
        : "needs splits and stroke counts for every length";
    return {
      lengths: [],
      dpsDecayPct: null,
      rateDeltaPct: null,
      signature: "insufficient-data",
      interpretation: `Not enough data to analyse this swim — ${missing}.`,
    };
  }

  const poolLength = POOL_LENGTH_M[course];
  const lengths: LengthMetrics[] = splits.map((splitSec, i) => {
    const strokes = strokeCounts[i];
    const dps = strokes > 0 ? poolLength / strokes : 0;
    const strokeRate = splitSec > 0 && strokes > 0 ? (strokes / splitSec) * 60 : null;
    return { index: i + 1, splitSec, strokes, dps, strokeRate };
  });

  const first = lengths[0];
  const last = lengths[lengths.length - 1];

  const dpsDecayPct = first.dps > 0 ? ((first.dps - last.dps) / first.dps) * 100 : null;
  const rateDeltaPct =
    first.strokeRate !== null && last.strokeRate !== null && first.strokeRate > 0
      ? ((last.strokeRate - first.strokeRate) / first.strokeRate) * 100
      : null;

  const decayed = dpsDecayPct !== null && dpsDecayPct >= 6;
  const rateCollapsed = rateDeltaPct !== null && rateDeltaPct <= -6;
  const rateHeld = rateDeltaPct !== null && Math.abs(rateDeltaPct) < 5;

  let signature: DpsSignature;
  if (decayed && rateCollapsed) signature = "both";
  else if (decayed && rateHeld) signature = "length-collapse";
  else if (rateCollapsed && !decayed) signature = "rate-collapse";
  else signature = "held";

  return {
    lengths,
    dpsDecayPct,
    rateDeltaPct,
    signature,
    interpretation: buildInterpretation(signature, dpsDecayPct, rateDeltaPct),
  };
}
