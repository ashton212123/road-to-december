import type { SwimSessionInterval } from "@/lib/db/schema";
import { addDaysISO } from "@/lib/time";

const EXCLUDE_MARKERS = ["w/u", "w/d", "warm-up", "warm up", "warmup", "cooldown", "cool-down", "cool down", "drill", "kick", "pull"];

function isExcluded(iv: SwimSessionInterval): boolean {
  const note = (iv.note ?? "").toLowerCase();
  const stroke = (iv.stroke ?? "").toLowerCase();
  return EXCLUDE_MARKERS.some((k) => note.includes(k) || stroke.includes(k));
}

/** Accepts "38s", "38", "1:10", "1:10.5" -- returns seconds, or null if unparseable. */
function parseTimeToSeconds(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase().replace(/s$/, "");
  if (trimmed.includes(":")) {
    const [m, s] = trimmed.split(":");
    const mins = Number(m);
    const secs = Number(s);
    if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
    return mins * 60 + secs;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Mean pace-per-100 (seconds) across a session's timed intervals, excluding
 * any interval marked warm-up/warm-down/drill -- those aren't race-pace
 * signal and would flatten a real trend. Null if the session has no usable
 * timed intervals (never fabricated as 0). */
export function computeSessionPacePer100(intervals: SwimSessionInterval[]): number | null {
  const paces = intervals
    .filter((iv) => !isExcluded(iv) && iv.avgTime && iv.distanceM > 0)
    .map((iv) => {
      const secs = parseTimeToSeconds(iv.avgTime!);
      return secs === null ? null : (secs / iv.distanceM) * 100;
    })
    .filter((p): p is number => p !== null);
  if (paces.length === 0) return null;
  return paces.reduce((a, b) => a + b, 0) / paces.length;
}

export type PacePoint = { date: string; paceSecPer100: number };

/** One point per session that has real timed-interval data -- sessions
 * logged the old way (manual load+text, no intervals) or with only
 * untimed/excluded intervals simply don't appear, never interpolated. */
export function buildPacePer100Series(sessions: { date: string; intervals: SwimSessionInterval[] | null }[]): PacePoint[] {
  return sessions
    .map((s) => {
      if (!s.intervals || s.intervals.length === 0) return null;
      const pace = computeSessionPacePer100(s.intervals);
      return pace === null ? null : { date: s.date, paceSecPer100: Math.round(pace * 100) / 100 };
    })
    .filter((p): p is PacePoint => p !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Rule-based takeaway comparing the earliest vs latest pace point within
 * the last 4 weeks -- no AI call. Pace is seconds-per-100, so a DROP is an
 * improvement. ±1.5% is the noise floor below which it reads as flat. */
export function pacePer100Takeaway(series: PacePoint[], todayISO: string): string | null {
  const since = addDaysISO(todayISO, -28);
  const recent = series.filter((p) => p.date >= since);
  if (recent.length < 2) return null;

  const first = recent[0].paceSecPer100;
  const last = recent[recent.length - 1].paceSecPer100;
  const pctChange = ((last - first) / first) * 100;

  if (pctChange <= -1.5) return `Pace per 100 improving over the last 4 weeks (${Math.abs(pctChange).toFixed(1)}% faster).`;
  if (pctChange >= 1.5) return `Pace per 100 declining over the last 4 weeks (${pctChange.toFixed(1)}% slower) -- worth a look.`;
  return "Pace per 100 flat over the last 4 weeks.";
}
