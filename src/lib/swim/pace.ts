import type { SwimSessionInterval } from "@/lib/db/schema";
import type { Zone } from "./zones";
import { addDaysISO } from "@/lib/time";

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

/** Mean pace-per-100 (seconds) for ONE zone's timed intervals in a session --
 * never blended across zones (the old computeSessionPacePer100 averaged an
 * EN1 10x100 and an SP1 4x50 into one meaningless number). Kick/pull/drill
 * intervals are excluded regardless of zone -- their pace isn't comparable
 * to full-stroke swim pace even within the same energy zone. Null if the
 * session has no usable timed intervals in that zone (never fabricated). */
export function computeZonePacePer100(intervals: SwimSessionInterval[], zone: Zone): number | null {
  const paces = intervals
    .filter((iv) => iv.zone === zone && !iv.isKick && !iv.isPull && !iv.isDrill && iv.avgTime && iv.distanceM > 0)
    .map((iv) => {
      const secs = parseTimeToSeconds(iv.avgTime!);
      return secs === null ? null : (secs / iv.distanceM) * 100;
    })
    .filter((p): p is number => p !== null);
  if (paces.length === 0) return null;
  return paces.reduce((a, b) => a + b, 0) / paces.length;
}

export type ZonePacePoint = { date: string; paceSecPer100: number };

/** One point per session that has real timed data in the given zone --
 * sessions without that zone (or without avgTime on it) simply don't
 * appear, never interpolated. */
export function buildZonePaceSeries(sessions: { date: string; intervals: SwimSessionInterval[] | null }[], zone: Zone): ZonePacePoint[] {
  return sessions
    .map((s) => {
      if (!s.intervals || s.intervals.length === 0) return null;
      const pace = computeZonePacePer100(s.intervals, zone);
      return pace === null ? null : { date: s.date, paceSecPer100: Math.round(pace * 100) / 100 };
    })
    .filter((p): p is ZonePacePoint => p !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Rule-based takeaway comparing the earliest vs latest pace point within
 * the last 4 weeks -- no AI call. Pace is seconds-per-100, so a DROP is an
 * improvement. ±1.5% is the noise floor below which it reads as flat. */
export function zonePaceTakeaway(series: ZonePacePoint[], todayISO: string, zone: Zone): string | null {
  const since = addDaysISO(todayISO, -28);
  const recent = series.filter((p) => p.date >= since);
  if (recent.length < 2) return null;

  const first = recent[0].paceSecPer100;
  const last = recent[recent.length - 1].paceSecPer100;
  const pctChange = ((last - first) / first) * 100;

  if (pctChange <= -1.5) return `${zone} pace improving over the last 4 weeks (${Math.abs(pctChange).toFixed(1)}% faster).`;
  if (pctChange >= 1.5) return `${zone} pace declining over the last 4 weeks (${pctChange.toFixed(1)}% slower) -- worth a look.`;
  return `${zone} pace flat over the last 4 weeks.`;
}
