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
 * rule-based from the same factors already computed -- no extra AI call. */
export function readinessActionLine(overall: ReadinessLight, trainingStatus: TrainingStatus): string {
  if (trainingStatus !== "healthy") return "Getting healthy IS the training right now.";
  if (overall === "green") return "Green light — today's the day to push.";
  if (overall === "yellow") return "Show up, keep the RPEs honest.";
  return "Recovery IS training today.";
}
