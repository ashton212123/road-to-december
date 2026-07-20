import { recentPeriodStarts, type Period } from "./periods";

function daysInPeriod(startISO: string, period: Period): number {
  if (period === "week") return 7;
  const d = new Date(`${startISO}T12:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}

function dayOffset(dateISO: string, periodStartISO: string): number {
  const a = new Date(`${periodStartISO}T00:00:00Z`).getTime();
  const b = new Date(`${dateISO}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Buckets {date,value} rows into two calendar-aligned day-of-period arrays
 * -- the period containing todayISO (shifted back by `offset` periods) and
 * the one immediately before it. Multiple rows on the same day are
 * averaged; days with nothing logged are null, never fabricated as 0. This
 * is a presentation-side transform only -- the caller's already-fetched
 * wide-window data is what gets bucketed, no new queries. */
export function currentVsPreviousDaily(
  rows: { date: string; value: number }[],
  period: Period,
  todayISO: string,
  offset = 0
): { current: (number | null)[]; previous: (number | null)[]; hasPrevious: boolean } {
  const [curStart] = recentPeriodStarts(todayISO, period, 1, offset);
  const [prevStart] = recentPeriodStarts(todayISO, period, 1, offset + 1);
  const length = Math.max(daysInPeriod(curStart, period), daysInPeriod(prevStart, period));

  const bucket = (startISO: string) => {
    const sums = new Map<number, { total: number; count: number }>();
    for (const r of rows) {
      const off = dayOffset(r.date, startISO);
      if (off < 0 || off >= length) continue;
      const entry = sums.get(off) ?? { total: 0, count: 0 };
      entry.total += r.value;
      entry.count += 1;
      sums.set(off, entry);
    }
    return Array.from({ length }, (_, i) => {
      const entry = sums.get(i);
      return entry ? entry.total / entry.count : null;
    });
  };

  const previous = bucket(prevStart);
  return { current: bucket(curStart), previous, hasPrevious: previous.some((v) => v !== null) };
}

const WEEK_DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** X-axis labels matching currentVsPreviousDaily's bucket length -- weekday
 * initials for a week, 1/6/11/16/21/26 tick marks for a month (every label
 * would be unreadable at that width). */
export function periodDayLabels(period: Period, length: number): string[] {
  if (period === "week") return WEEK_DAY_LABELS.slice(0, length);
  return Array.from({ length }, (_, i) => ((i % 5 === 0 ? String(i + 1) : "")));
}
