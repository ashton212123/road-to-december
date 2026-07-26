import type { ReadinessLight } from "./readiness";

export type TrainingStatus = "healthy" | "sick" | "injured" | "break";

/** While non-healthy, readiness always reads as Caution -- not a literal
 * biometric read (the raw signals still compute), but a deliberate
 * simplification: "we're in a holding pattern," never green (don't push)
 * and never red/Rest (that implies today specifically is bad, not a
 * general excused state). */
export function applyTrainingStatusCap(overall: ReadinessLight, trainingStatus: TrainingStatus): ReadinessLight {
  return trainingStatus === "healthy" ? overall : "yellow";
}

/** Gentler Streak pattern: one coach-voiced line under the status word,
 * rule-based from the same factors already computed -- no extra AI call.
 * Loop 39.3: copy pass -- each line states what to do and why, never
 * motivational filler. */
export function readinessActionLine(overall: ReadinessLight, trainingStatus: TrainingStatus): string {
  if (trainingStatus !== "healthy") return "Getting healthy IS the training right now.";
  if (overall === "green") return "Signals are clear — this is a day to take the hard set.";
  if (overall === "yellow") return "Train as planned; keep the RPEs honest and don't chase the clock.";
  return "Reduce intensity, keep frequency. Recovery is the adaptation.";
}
