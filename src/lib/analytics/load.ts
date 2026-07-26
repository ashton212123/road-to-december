import { mondayOf } from "@/lib/time";

export type DailySessionLoad = {
  date: string;
  load: number;
  swimLoad: number;
  gymLoad: number;
  sources: ("swim" | "gym")[];
  estimated: boolean; // true when any part of this date's load came from the timestamp-spread fallback, not a logged session RPE
};

/**
 * Unified swim+gym training load (loop 37, G4/G12). `session_loads` rows
 * (written at save time by both the swim session logger and the gym
 * session-complete flow, loop 32/34) are the primary source -- they carry a
 * real logged session RPE x duration, not an estimate. A gym date with
 * workout-log sets but no `session_loads` row (pre-loop-34 data, or a
 * session finished without rating it) falls back to the original
 * timestamp-spread estimate, flagged via `estimated`.
 */
export function computeDailySessionLoads(input: {
  sessionLoads: { date: string; kind: "gym" | "swim"; load: number }[];
  workoutLogs: { date: string; rpe: string | null; createdAt: Date | string }[];
}): DailySessionLoad[] {
  const byDate = new Map<string, DailySessionLoad>();

  for (const sl of input.sessionLoads) {
    const cur = byDate.get(sl.date) ?? { date: sl.date, load: 0, swimLoad: 0, gymLoad: 0, sources: [], estimated: false };
    cur.load += sl.load;
    if (sl.kind === "swim") cur.swimLoad += sl.load;
    else cur.gymLoad += sl.load;
    if (!cur.sources.includes(sl.kind)) cur.sources.push(sl.kind);
    byDate.set(sl.date, cur);
  }

  const gymDatesWithLoggedLoad = new Set([...byDate.values()].filter((d) => d.sources.includes("gym")).map((d) => d.date));
  const estimateInput = new Map<string, { rpes: number[]; timestamps: number[] }>();
  for (const log of input.workoutLogs) {
    if (gymDatesWithLoggedLoad.has(log.date)) continue; // already has a real logged session RPE for this date
    const bucket = estimateInput.get(log.date) ?? { rpes: [], timestamps: [] };
    if (log.rpe !== null) bucket.rpes.push(Number(log.rpe));
    bucket.timestamps.push(new Date(log.createdAt).getTime());
    estimateInput.set(log.date, bucket);
  }
  for (const [date, { rpes, timestamps }] of estimateInput) {
    if (timestamps.length === 0) continue;
    // sRPE fallback: a session logged without any RPE still happened -- assume
    // moderate (5) rather than dropping the date, which made whole sessions
    // vanish from load, ACWR, and the "first logged session" gate.
    const avgRpe = rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : 5;
    const spreadMinutes = Math.max(
      10, // floor so a handful of sets logged seconds apart doesn't read as zero load
      (Math.max(...timestamps) - Math.min(...timestamps)) / 60000
    );
    const estLoad = Math.round(avgRpe * spreadMinutes);
    const cur = byDate.get(date) ?? { date, load: 0, swimLoad: 0, gymLoad: 0, sources: [], estimated: false };
    cur.load += estLoad;
    cur.gymLoad += estLoad;
    if (!cur.sources.includes("gym")) cur.sources.push("gym");
    cur.estimated = true;
    byDate.set(date, cur);
  }

  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Distinct logged-session dates bucketed by Monday-of-week -- same weekStart
 * cadence as computeWeeklyTonnage/computeWeeklyHardSets, so the Load card's
 * Tonnage | Hard sets | Sessions tabs share one x-axis. */
export function computeWeeklySessions(dailyLoads: DailySessionLoad[]): { weekStart: string; count: number }[] {
  const byWeek = new Map<string, number>();
  for (const { date } of dailyLoads) {
    const weekStart = mondayOf(date);
    byWeek.set(weekStart, (byWeek.get(weekStart) ?? 0) + 1);
  }
  return [...byWeek.entries()].map(([weekStart, count]) => ({ weekStart, count })).sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

export type WeeklyLoad = { weekStart: string; load: number; swimLoad: number; gymLoad: number };

export function computeWeeklyLoad(daily: DailySessionLoad[]): WeeklyLoad[] {
  const byWeek = new Map<string, WeeklyLoad>();
  for (const d of daily) {
    const weekStart = mondayOf(d.date);
    const cur = byWeek.get(weekStart) ?? { weekStart, load: 0, swimLoad: 0, gymLoad: 0 };
    cur.load += d.load;
    cur.swimLoad += d.swimLoad;
    cur.gymLoad += d.gymLoad;
    byWeek.set(weekStart, cur);
  }
  return [...byWeek.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

/** Week-over-week % change in total load -- the descriptive replacement for
 * ACWR as a readiness input (loop 37, G5): no rolling-window math, just
 * "this week vs last week," with the Impellizzeri critique attached
 * wherever it's shown rather than treated as a risk score. */
export function computeWeekOverWeekRamp(weekly: { weekStart: string; load: number }[]): { weekStart: string; pctChange: number | null }[] {
  const sorted = [...weekly].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
  return sorted.map((w, i) => {
    if (i === 0) return { weekStart: w.weekStart, pctChange: null };
    const prev = sorted[i - 1];
    const pctChange = prev.load > 0 ? ((w.load - prev.load) / prev.load) * 100 : null;
    return { weekStart: w.weekStart, pctChange };
  });
}

export type AcwrPoint = { date: string; acute: number; chronic: number; ratio: number | null };

/**
 * 7-day acute vs 28-day chronic rolling average load ratio. Kept for the
 * Analytics Load chart (still descriptively interesting) but, as of loop 37,
 * deliberately NOT fed into computeReadinessSignals -- ACWR has known
 * statistical problems (mathematical coupling between acute/chronic, no
 * demonstrated causal link to injury) and no longer drives any light.
 */
export function computeAcwr(dailyLoads: DailySessionLoad[]): AcwrPoint[] {
  const sorted = [...dailyLoads].sort((a, b) => (a.date < b.date ? -1 : 1));
  const loadByDate = new Map(sorted.map((d) => [d.date, d.load]));
  const dates = sorted.map((d) => d.date);

  return dates.map((date) => {
    const acuteWindow = windowSum(loadByDate, date, 7);
    const chronicWindow = windowSum(loadByDate, date, 28);
    const acute = acuteWindow.sum / 7;
    const chronic = chronicWindow.days > 0 ? chronicWindow.sum / 28 : 0;
    // A ratio needs an actual chronic baseline distinct from the acute
    // window -- if every day of logged history falls inside the last 7
    // days, chronic == acute and the ratio is a guaranteed (and
    // meaningless) 4.00 for any brand-new logger. Only trust the ratio once
    // there's at least one day of data older than the acute window.
    const olderDays = chronicWindow.days - acuteWindow.days;
    const ratio = chronic > 0 && olderDays > 0 ? acute / chronic : null;
    return { date, acute: Math.round(acute), chronic: Math.round(chronic), ratio };
  });
}

function windowSum(loadByDate: Map<string, number>, endDate: string, days: number) {
  let sum = 0;
  let daysWithData = 0;
  const end = new Date(`${endDate}T12:00:00Z`);
  for (let i = 0; i < days; i++) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const load = loadByDate.get(iso);
    if (load !== undefined) {
      sum += load;
      daysWithData++;
    }
  }
  return { sum, days: daysWithData };
}
