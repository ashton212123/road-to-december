/**
 * Two-point critical speed, anchored on same-course race bests only. CS
 * approximates MLSS (EVIDENCE.E6) but was validated in front crawl -- using
 * it here is an explicit extrapolation, carried as a mandatory caveat on
 * every result rather than buried in a code comment.
 */

import type { Course } from "./course";

export type CriticalSpeed = {
  metresPerSec: number;
  pacePer100Sec: number;
  basis: { shortEvent: string; shortMs: number; longEvent: string; longMs: number; course: Course };
  method: "race-anchored" | "test-set";
  caveat: string;
};

const CAVEAT =
  "Critical speed was validated in front crawl against maximal lactate steady state (Wakayoshi 1992) [moderate]. Anchoring it on breaststroke race bests is an extrapolation [extrapolated] — treat this as a self-consistent anchor for tracking change, not a measured lactate threshold.";

const EVENT_DISTANCE_M: Record<string, number> = {
  "50 Breast": 50,
  "100 Breast": 100,
  "200 Breast": 200,
  "200 IM": 200,
  "400 IM": 400,
};

const SHORT_EVENT = "100 Breast";
const LONG_EVENT = "200 Breast";

/** Prefers 100 BR + 200 BR from the same course, race rows only. Never
 * blends courses and never falls back to practice times -- returns null
 * when the pairing isn't available rather than approximating. */
export function computeCriticalSpeed(
  times: { event: string; timeMs: number; course: Course; isRace: boolean }[]
): CriticalSpeed | null {
  const races = times.filter((t) => t.isRace);

  for (const course of ["SCM", "LCM"] as Course[]) {
    const short = races.filter((t) => t.event === SHORT_EVENT && t.course === course).sort((a, b) => a.timeMs - b.timeMs)[0];
    const long = races.filter((t) => t.event === LONG_EVENT && t.course === course).sort((a, b) => a.timeMs - b.timeMs)[0];
    if (!short || !long) continue;

    const d1 = EVENT_DISTANCE_M[SHORT_EVENT];
    const d2 = EVENT_DISTANCE_M[LONG_EVENT];
    const t1 = short.timeMs / 1000;
    const t2 = long.timeMs / 1000;
    if (t2 <= t1) continue;

    const metresPerSec = (d2 - d1) / (t2 - t1);
    if (!Number.isFinite(metresPerSec) || metresPerSec <= 0) continue;

    return {
      metresPerSec,
      pacePer100Sec: 100 / metresPerSec,
      basis: { shortEvent: SHORT_EVENT, shortMs: short.timeMs, longEvent: LONG_EVENT, longMs: long.timeMs, course },
      method: "race-anchored",
      caveat: CAVEAT,
    };
  }

  return null;
}

export type ZonePaceBand = { lowSecPer100: number; highSecPer100: number; label: string };

/** Suggested per-100 pace bands as % of CS pace, each tagged
 * [coaching convention] -- not a measured lactate curve. */
export function zonePaceTargets(cs: CriticalSpeed): Record<"EN1" | "EN2" | "EN3", ZonePaceBand> {
  const base = cs.pacePer100Sec;
  return {
    EN1: { lowSecPer100: base * 1.08, highSecPer100: base * 1.15, label: "EN1 pace band [coaching convention]" },
    EN2: { lowSecPer100: base * 0.98, highSecPer100: base * 1.03, label: "EN2 pace band [coaching convention]" },
    EN3: { lowSecPer100: base * 0.93, highSecPer100: base * 0.97, label: "EN3 pace band [coaching convention]" },
  };
}
