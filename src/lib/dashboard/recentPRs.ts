import { bestSetE1RM } from "@/lib/train/e1rm";

export type PrEntry = {
  kind: "strength" | "swim" | "power";
  name: string;
  date: string;
  valueLabel: string;
  deltaPct: number | null;
};

type MainLiftLog = { exerciseName: string; date: string; weightKg: string | null; reps: number | null; isMainLift: boolean };
type SwimTimeRow = { event: string; date: string; timeMs: number };
type CmjRow = { date: string; bestOf3Cm: string };

/** Scans available history for the most recent PR on each metric (best e1RM
 * per main lift, best time per swim event, best CMJ) and returns the 3 most
 * recent PRs overall. Bounded to whatever window the caller already fetched
 * -- a personal app at this scale doesn't need a full-history index. */
export function findRecentPRs(params: { mainLiftLogs: MainLiftLog[]; swimTimes: SwimTimeRow[]; cmjTests: CmjRow[] }): PrEntry[] {
  const prs: PrEntry[] = [];

  const byLiftDate = new Map<string, Map<string, { weightKg: number | null; reps: number | null }[]>>();
  for (const log of params.mainLiftLogs) {
    if (!log.isMainLift) continue;
    if (!byLiftDate.has(log.exerciseName)) byLiftDate.set(log.exerciseName, new Map());
    const byDate = byLiftDate.get(log.exerciseName)!;
    if (!byDate.has(log.date)) byDate.set(log.date, []);
    byDate.get(log.date)!.push({ weightKg: log.weightKg ? Number(log.weightKg) : null, reps: log.reps });
  }
  for (const [lift, byDate] of byLiftDate) {
    const points = [...byDate.entries()]
      .map(([date, sets]) => ({ date, e1rm: bestSetE1RM(sets) }))
      .filter((p): p is { date: string; e1rm: number } => p.e1rm !== null)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    let best = -Infinity;
    for (const p of points) {
      if (p.e1rm > best) {
        if (best !== -Infinity) {
          prs.push({
            kind: "strength",
            name: lift,
            date: p.date,
            valueLabel: `${p.e1rm.toFixed(1)}kg e1RM`,
            deltaPct: ((p.e1rm - best) / best) * 100,
          });
        }
        best = p.e1rm;
      }
    }
  }

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
