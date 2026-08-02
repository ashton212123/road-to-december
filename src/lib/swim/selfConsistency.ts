/**
 * WS4 §4b Task 3 -- pure decision logic for The Analyst's 3-run
 * self-consistency check. Given three independently-computed
 * parsedDistanceM totals (see analyst.ts), decides whether they agree
 * enough to trust and which value to use. Only exact agreement counts --
 * this never picks a "closest" number by proximity, so a near-miss is
 * treated the same as total disagreement.
 */

export type ConsistencyConfidence = "high" | "medium";

export type ConsistencyVerdict = {
  /** null when all three totals differ from each other -- callers must not
   * write a row in that case (WS4 §4b Task 3). */
  confidence: ConsistencyConfidence | null;
  agreedTotal: number | null;
};

export function evaluateConsistency(totals: [number, number, number]): ConsistencyVerdict {
  const [a, b, c] = totals;
  if (a === b && b === c) return { confidence: "high", agreedTotal: a };
  if (a === b) return { confidence: "medium", agreedTotal: a };
  if (b === c) return { confidence: "medium", agreedTotal: b };
  if (a === c) return { confidence: "medium", agreedTotal: a };
  return { confidence: null, agreedTotal: null };
}
