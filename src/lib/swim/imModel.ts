/**
 * The 400 IM (and 200 IM) engine: leg-by-leg split targets from the
 * standard elite IM split shape [coaching convention], compared against
 * logged splits when available. Never fabricates actual/delta data for legs
 * that weren't logged.
 */

import type { Course } from "./course";

export type ImLeg = "fly" | "back" | "breast" | "free";

export type ImSplitModel = {
  event: "200 IM" | "400 IM";
  legs: { leg: ImLeg; targetSec: number; actualSec: number | null; deltaSec: number | null }[];
  totalTargetSec: number;
  strongestLeg: ImLeg | null;
  weakestLeg: ImLeg | null;
  aerobicNote: string;
};

const LEG_ORDER: ImLeg[] = ["fly", "back", "breast", "free"];

// [coaching convention] -- standard elite IM split shape, as fractions of total time.
const FRACTIONS: Record<"200 IM" | "400 IM", Record<ImLeg, number>> = {
  "400 IM": { fly: 0.243, back: 0.262, breast: 0.283, free: 0.212 },
  "200 IM": { fly: 0.232, back: 0.263, breast: 0.285, free: 0.22 },
};

const AEROBIC_NOTE =
  "A 400 IM at this level is a ~4½-minute maximal effort, which is roughly 75–85% aerobically supplied [moderate, extrapolated to the 400 IM specifically]. That is why EN1/EN2 volume — not more sprint work — is what moves this event.";

export function buildImSplitModel(params: {
  event: "200 IM" | "400 IM";
  targetTotalMs: number;
  loggedSplits: number[] | null; // 4 splits in ms, ordered fly/back/breast/free
  course: Course;
}): ImSplitModel {
  const { event, targetTotalMs } = params;
  const fractions = FRACTIONS[event];
  const totalTargetSec = targetTotalMs / 1000;
  const loggedSplits = params.loggedSplits && params.loggedSplits.length === 4 ? params.loggedSplits : null;

  const legs = LEG_ORDER.map((leg, i) => {
    const targetSec = totalTargetSec * fractions[leg];
    const actualSec = loggedSplits ? loggedSplits[i] / 1000 : null;
    const deltaSec = actualSec !== null ? actualSec - targetSec : null;
    return { leg, targetSec, actualSec, deltaSec };
  });

  let strongestLeg: ImLeg | null = null;
  let weakestLeg: ImLeg | null = null;
  const withDelta = legs.filter((l): l is (typeof legs)[number] & { deltaSec: number } => l.deltaSec !== null);
  if (withDelta.length > 0) {
    strongestLeg = withDelta.reduce((a, b) => (a.deltaSec < b.deltaSec ? a : b)).leg;
    weakestLeg = withDelta.reduce((a, b) => (a.deltaSec > b.deltaSec ? a : b)).leg;
  }

  return { event, legs, totalTargetSec, strongestLeg, weakestLeg, aerobicNote: AEROBIC_NOTE };
}
