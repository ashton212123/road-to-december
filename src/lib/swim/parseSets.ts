/**
 * Best-effort total distance parser for free-text swim set descriptions,
 * e.g. "10x100 BR @1:30, main set 6x200 IM" -> 2200. Looks for <count>x<distance>
 * patterns (x or ×) and sums count*distance. Returns null if nothing parseable.
 * Stroke/interval detail isn't structured-parsed -- the raw text is kept
 * verbatim as the source of truth and shown alongside the parsed distance,
 * rather than guessing at a stroke/interval schema from free text (see
 * DECISIONS.md: distance is the one number worth extracting reliably;
 * anything else risks misparsing and showing wrong data).
 */
export function estimateDistanceM(text: string): number | null {
  const matches = [...text.matchAll(/(\d+)\s*[x×]\s*(\d+)/gi)];
  if (matches.length === 0) return null;
  const total = matches.reduce((sum, m) => sum + Number(m[1]) * Number(m[2]), 0);
  return total > 0 ? total : null;
}
