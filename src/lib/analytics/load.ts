export type DailySessionLoad = { date: string; load: number };

/**
 * Session load = session RPE × duration (spec). There's no explicit
 * duration field logged, so duration is derived from the spread between
 * the first and last logged set's timestamp on that date (a reasonable
 * proxy for time-on-task), and session RPE is the average RPE of that
 * date's sets.
 */
export function computeDailySessionLoads(
  logs: { date: string; rpe: string | null; createdAt: Date | string }[]
): DailySessionLoad[] {
  const byDate = new Map<string, { rpes: number[]; timestamps: number[] }>();
  for (const log of logs) {
    if (!byDate.has(log.date)) byDate.set(log.date, { rpes: [], timestamps: [] });
    const bucket = byDate.get(log.date)!;
    if (log.rpe !== null) bucket.rpes.push(Number(log.rpe));
    bucket.timestamps.push(new Date(log.createdAt).getTime());
  }

  const results: DailySessionLoad[] = [];
  for (const [date, { rpes, timestamps }] of byDate) {
    if (rpes.length === 0 || timestamps.length === 0) continue;
    const avgRpe = rpes.reduce((a, b) => a + b, 0) / rpes.length;
    const spreadMinutes = Math.max(
      10, // floor so a handful of sets logged seconds apart doesn't read as zero load
      (Math.max(...timestamps) - Math.min(...timestamps)) / 60000
    );
    results.push({ date, load: Math.round(avgRpe * spreadMinutes) });
  }
  return results.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export type AcwrPoint = { date: string; acute: number; chronic: number; ratio: number | null };

/** 7-day acute vs 28-day chronic rolling average load ratio. Flag > 1.5. */
export function computeAcwr(dailyLoads: DailySessionLoad[]): AcwrPoint[] {
  const sorted = [...dailyLoads].sort((a, b) => (a.date < b.date ? -1 : 1));
  const loadByDate = new Map(sorted.map((d) => [d.date, d.load]));
  const dates = sorted.map((d) => d.date);

  return dates.map((date) => {
    const acuteWindow = windowSum(loadByDate, date, 7);
    const chronicWindow = windowSum(loadByDate, date, 28);
    const acute = acuteWindow.sum / 7;
    const chronic = chronicWindow.days > 0 ? chronicWindow.sum / 28 : 0;
    const ratio = chronic > 0 ? acute / chronic : null;
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
