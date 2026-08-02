/**
 * WS4 §3 -- statedTotalDistanceM and parsedDistanceM are two independently
 * sourced numbers (one from the athlete's own words, one computed by The
 * Analyst from the same text) that must never collapse into one "true"
 * figure. This module's only job is to surface the delta between them --
 * never to pick a winner, adjust either value, or smooth a mismatch away.
 * Used by the §4 ingestion path and the §5 session-detail StatusChip.
 */

export type DistanceChecksum = {
  statedM: number | null;
  parsedM: number;
  /** parsedM - statedM. Null when there's no stated figure to compare against. */
  deltaM: number | null;
  /** abs(deltaM) as a percentage of statedM. Null when there's no stated figure. */
  deltaPct: number | null;
  /** True on ANY non-zero delta, however small -- WS4 §5 shows a StatusChip
   * whenever this is true, not just past some tolerance threshold. */
  mismatch: boolean;
};

export function checkDistance(statedM: number | null, parsedM: number): DistanceChecksum {
  if (statedM === null) {
    return { statedM: null, parsedM, deltaM: null, deltaPct: null, mismatch: false };
  }
  const deltaM = parsedM - statedM;
  return {
    statedM,
    parsedM,
    deltaM,
    deltaPct: statedM !== 0 ? (Math.abs(deltaM) / statedM) * 100 : null,
    mismatch: deltaM !== 0,
  };
}
