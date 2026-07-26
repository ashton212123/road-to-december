export type PrEntry = {
  kind: "swim" | "power";
  name: string;
  date: string;
  valueLabel: string;
  deltaPct: number | null;
};

type SwimTimeRow = { event: string; date: string; timeMs: number };
type CmjRow = { date: string; bestOf3Cm: string };

/** Scans available history for the most recent PR on each metric (best time
 * per swim event, best CMJ) and returns the 3 most recent PRs overall.
 * Loop 39.2: gym e1RM PRs deliberately excluded -- they're performance data
 * too, but already surfaced on /analytics?tab=train, and this card is meant
 * to stay swim/power-focused rather than duplicate that view. Bounded to
 * whatever window the caller already fetched -- a personal app at this scale
 * doesn't need a full-history index. */
export function findRecentPRs(params: { swimTimes: SwimTimeRow[]; cmjTests: CmjRow[] }): PrEntry[] {
  const prs: PrEntry[] = [];

  const byEvent = new Map<string, SwimTimeRow[]>();
  for (const t of params.swimTimes) {
    if (!byEvent.has(t.event)) byEvent.set(t.event, []);
    byEvent.get(t.event)!.push(t);
  }
  for (const [event, times] of byEvent) {
    const sorted = [...times].sort((a, b) => (a.date < b.date ? -1 : 1));
    let best = Infinity;
    for (const t of sorted) {
      if (t.timeMs < best) {
        if (best !== Infinity) {
          prs.push({
            kind: "swim",
            name: event,
            date: t.date,
            valueLabel: formatSwimTime(t.timeMs),
            deltaPct: ((best - t.timeMs) / best) * 100,
          });
        }
        best = t.timeMs;
      }
    }
  }

  const cmjSorted = [...params.cmjTests].sort((a, b) => (a.date < b.date ? -1 : 1));
  let bestCmj = -Infinity;
  for (const c of cmjSorted) {
    const v = Number(c.bestOf3Cm);
    if (v > bestCmj) {
      if (bestCmj !== -Infinity) {
        prs.push({ kind: "power", name: "CMJ", date: c.date, valueLabel: `${v.toFixed(1)}cm`, deltaPct: ((v - bestCmj) / bestCmj) * 100 });
      }
      bestCmj = v;
    }
  }

  return prs.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
}

function formatSwimTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = (totalSeconds % 60).toFixed(2);
  return minutes > 0 ? `${minutes}:${seconds.padStart(5, "0")}` : `${seconds}s`;
}
