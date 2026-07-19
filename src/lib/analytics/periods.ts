import { mondayOf } from "@/lib/time";

export type Period = "week" | "month";

/** Start date (ISO) of the period containing `dateISO`. */
export function periodStart(dateISO: string, period: Period): string {
  if (period === "week") return mondayOf(dateISO);
  return `${dateISO.slice(0, 7)}-01`;
}

function shiftPeriod(startISO: string, period: Period, count: number): string {
  const d = new Date(`${startISO}T12:00:00Z`);
  if (period === "week") {
    d.setUTCDate(d.getUTCDate() + count * 7);
  } else {
    d.setUTCMonth(d.getUTCMonth() + count);
  }
  return d.toISOString().slice(0, 10);
}

/** The last `count` period-start dates ending `offset` periods before the one containing
 * `todayISO` (offset 0 = current period), oldest first. */
export function recentPeriodStarts(todayISO: string, period: Period, count: number, offset = 0): string[] {
  const end = shiftPeriod(periodStart(todayISO, period), period, -offset);
  return Array.from({ length: count }, (_, i) => shiftPeriod(end, period, i - (count - 1)));
}

/** Human label for a period start, e.g. "Jul 14" (week) or "Jul 2026" (month). */
export function periodLabel(startISO: string, period: Period): string {
  const d = new Date(`${startISO}T12:00:00Z`);
  if (period === "week") return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export type AggType = "max" | "min" | "avg" | "sum";

/** Buckets `{date, value}` rows into the given period starts and aggregates each bucket. Periods with no rows get `null` (never fabricated as 0). */
export function aggregateByPeriod(
  rows: { date: string; value: number }[],
  period: Period,
  periodStarts: string[],
  agg: AggType
): (number | null)[] {
  const byPeriod = new Map<string, number[]>();
  for (const r of rows) {
    const key = periodStart(r.date, period);
    if (!byPeriod.has(key)) byPeriod.set(key, []);
    byPeriod.get(key)!.push(r.value);
  }
  return periodStarts.map((p) => {
    const values = byPeriod.get(p);
    if (!values || values.length === 0) return null;
    if (agg === "max") return Math.max(...values);
    if (agg === "min") return Math.min(...values);
    if (agg === "sum") return values.reduce((a, b) => a + b, 0);
    return values.reduce((a, b) => a + b, 0) / values.length;
  });
}

export function pctChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
