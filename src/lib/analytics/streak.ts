import { addDaysISO, dayKeyForDate } from "@/lib/time";

type PhaseWithSessions = { startDate: string; endDate: string; sessions: { dayKey: string }[] };

/**
 * Rolling 4-week (28-day) training consistency: scheduled gym sessions
 * logged vs planned. Replaces the old run-length streak (V4 P3) -- streaks
 * that reset to zero on one missed day are a documented top reason fitness
 * apps get abandoned, and this number can't crater from a single miss the
 * way a streak count does. Days from `excusedFromISO` on (a non-healthy
 * trainingStatus) are dropped from the denominator entirely -- being sick/
 * injured/on a break can't drag the % down.
 */
export function computeConsistencyPct(params: {
  today: string;
  phases: PhaseWithSessions[];
  loggedDates: Set<string>;
  excusedFromISO?: string | null;
}): { pct: number | null; done: number; planned: number } {
  const { today, phases, loggedDates } = params;
  const excusedFrom = params.excusedFromISO ?? null;
  let done = 0;
  let planned = 0;

  for (let i = 0; i < 28; i++) {
    const date = addDaysISO(today, -i);
    const phase = phases.find((p) => date >= p.startDate && date <= p.endDate);
    if (!phase) continue;
    if (!phase.sessions.some((s) => s.dayKey === dayKeyForDate(date))) continue;
    if (excusedFrom !== null && date >= excusedFrom) continue;
    planned++;
    if (loggedDates.has(date)) done++;
  }

  return { pct: planned > 0 ? Math.round((done / planned) * 100) : null, done, planned };
}
