/**
 * SCM/LCM course tracking. He trains SCM, races LCM -- times from the two
 * courses are systematically different (breaststroke gains the most per
 * turn, and SCM has twice as many turns) and must never be blended in a
 * trend or regression. Conversion here is a coaching-convention estimate
 * (EVIDENCE.E11), never treated as a measurement.
 */

export type Course = "SCM" | "LCM";
export const COURSES: Course[] = ["SCM", "LCM"];

// Additive SCM->LCM offset in ms, turn-count driven. [coaching convention]
const LCM_OFFSET_MS: Record<string, number> = {
  "50 Breast": 1000,
  "100 Breast": 2200,
  "200 Breast": 4500,
  "200 IM": 3500,
  "400 IM": 7000,
};

export function isConvertible(event: string): boolean {
  return event in LCM_OFFSET_MS;
}

/** Estimated SCM->LCM conversion. Returns null for events without a known
 * factor rather than guessing. Always render with "estimated conversion"
 * adjacent in the UI. */
export function scmToLcmMs(event: string, scmMs: number): number | null {
  const offset = LCM_OFFSET_MS[event];
  if (offset === undefined) return null;
  return Math.round(scmMs + offset);
}

export function lcmToScmMs(event: string, lcmMs: number): number | null {
  const offset = LCM_OFFSET_MS[event];
  if (offset === undefined) return null;
  return Math.round(lcmMs - offset);
}
