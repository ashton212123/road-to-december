import type { getAnalyticsPageDataRaw } from "@/lib/db/analyticsQuery";
import { computeMeetReadiness } from "@/lib/swim/readiness";
import { swimTakeaway } from "@/lib/analytics/takeaways";
import { mondayOf, addDaysISO } from "@/lib/time";
import type { SwimWeek, ZoneWeek } from "@/components/analytics/SwimTrainingBlock";
import type { ZoneDistance } from "@/lib/swim/zones";
import { computeCriticalSpeed } from "@/lib/swim/criticalSpeed";
import type { Course } from "@/lib/swim/course";

type Raw = Awaited<ReturnType<typeof getAnalyticsPageDataRaw>>;

const SWIM_EVENTS_WITH_SPLITS = ["200 Breast"];
const IM_EVENTS = ["200 IM", "400 IM"] as const;
const CANONICAL_EVENTS = ["50 Breast", "100 Breast", "200 Breast", "200 IM", "400 IM"];

/** Everything the Swim page (and Analytics' overview takeaway card) derives
 * from the shared batch query — one place, so /swim and /analytics can never
 * drift apart on how swim numbers are computed. */
export function buildSwimViewModel(raw: Raw, today: string) {
  const swimTimes = raw.swimTimes;
  const swimSessions = raw.swimSessions;

  const splitAutopsy = swimTimes
    .filter((s) => SWIM_EVENTS_WITH_SPLITS.includes(s.event) && s.splits && s.splits.length === 4)
    .slice(0, 5)
    .map((s) => ({
      date: s.date,
      event: s.event,
      course: s.course,
      splits: s.splits as number[],
      strokeCounts: (s.strokeCounts as number[]) ?? [],
      isRace: s.isPb || s.meetName !== null,
    }));

  // Most recent RACE with 4 logged splits per IM event -- the leg-by-leg
  // splits an IM swims are structurally the same shape (4 entries) as a 200
  // Breast's 50-splits, just fly/back/breast/free instead of 4x50 breast.
  const imRaceSplits = Object.fromEntries(
    IM_EVENTS.map((ev) => {
      const row = swimTimes.find((s) => s.event === ev && (s.isPb || s.meetName !== null) && s.splits && s.splits.length === 4);
      return [ev, row ? { splits: row.splits as number[], course: row.course, date: row.date } : null];
    })
  ) as Record<(typeof IM_EVENTS)[number], { splits: number[]; course: Course | null; date: string } | null>;

  const criticalSpeed = computeCriticalSpeed(
    swimTimes
      .filter((s) => s.course !== null)
      .map((s) => ({ event: s.event, timeMs: s.timeMs, course: s.course as Course, isRace: s.isPb || s.meetName !== null }))
  );

  const meetsWithReadiness = raw.meetsWithEvents.map((meet) => {
    const targetCourse = meet.course ?? "LCM";
    return {
      id: meet.id,
      name: meet.name,
      date: meet.date,
      course: meet.course,
      events: meet.events.map((ev) => {
        const loggedTimes = swimTimes
          .filter((s) => s.event === ev.event)
          .map((s) => ({ date: s.date, timeMs: s.timeMs, isRace: s.isPb || s.meetName !== null, course: s.course }));
        return {
          id: ev.id,
          event: ev.event,
          currentTimeMs: ev.currentTimeMs,
          targetTimeMs: ev.targetTimeMs,
          readiness: computeMeetReadiness({ event: ev.event, targetTimeMs: ev.targetTimeMs, loggedTimes, meetDate: meet.date, today, targetCourse }),
        };
      }),
    };
  });

  const latestByEvent = new Map<string, number>();
  for (const s of [...swimTimes].sort((a, b) => (a.date < b.date ? 1 : -1))) {
    if (!latestByEvent.has(s.event)) latestByEvent.set(s.event, s.timeMs);
  }
  const allEventNames = [...new Set([...CANONICAL_EVENTS, ...swimTimes.map((s) => s.event)])];

  const byWeek = new Map<string, SwimWeek>();
  for (const s of swimSessions) {
    const wk = mondayOf(s.date);
    const cur = byWeek.get(wk) ?? { weekStart: wk, distanceM: 0, sessions: 0, loadSum: 0 };
    cur.distanceM += s.parsedDistanceM ?? 0;
    cur.sessions += 1;
    cur.loadSum += s.loadRating;
    byWeek.set(wk, cur);
  }
  const thisMonday = mondayOf(today);
  const swimWeekly: SwimWeek[] = Array.from({ length: 8 }, (_, i) => {
    const weekStart = addDaysISO(thisMonday, -7 * (7 - i));
    return byWeek.get(weekStart) ?? { weekStart, distanceM: 0, sessions: 0, loadSum: 0 };
  });

  const zoneByWeek = new Map<string, ZoneDistance>();
  for (const s of swimSessions) {
    const wk = mondayOf(s.date);
    const cur = zoneByWeek.get(wk) ?? {};
    for (const [z, m] of Object.entries((s.zoneDistanceM as ZoneDistance | null) ?? {})) {
      const zone = z as keyof ZoneDistance;
      cur[zone] = (cur[zone] ?? 0) + (m ?? 0);
    }
    zoneByWeek.set(wk, cur);
  }
  const zoneWeekly: ZoneWeek[] = swimWeekly.map((w) => {
    const zoneDistance = zoneByWeek.get(w.weekStart) ?? {};
    return { weekStart: w.weekStart, totalM: w.distanceM, zoneDistance };
  });

  const breastKickByWeek = new Map<string, number>();
  for (const s of swimSessions) {
    const wk = mondayOf(s.date);
    breastKickByWeek.set(wk, (breastKickByWeek.get(wk) ?? 0) + (s.breastKickM ?? 0));
  }
  const breastKickWeekly = swimWeekly.map((w) => ({ weekStart: w.weekStart, m: breastKickByWeek.get(w.weekStart) ?? 0 }));

  const latestSwimSession =
    [...swimSessions].sort((a, b) => (a.date < b.date ? 1 : -1)).find((s) => s.intervals && s.intervals.length > 0) ?? null;

  return {
    splitAutopsy,
    imRaceSplits,
    criticalSpeed,
    breastKickWeekly,
    meetsWithReadiness,
    latestTimeByEvent: Object.fromEntries(latestByEvent),
    allSwimTimesByEvent: Object.fromEntries(
      allEventNames.map((ev) => [
        ev,
        swimTimes
          .filter((s) => s.event === ev)
          .map((s) => ({ date: s.date, timeMs: s.timeMs, isRace: s.isPb || s.meetName !== null, course: s.course })),
      ])
    ),
    pbsByEventAndCourse: (() => {
      const best = new Map<string, { event: string; course: "SCM" | "LCM"; timeMs: number; date: string }>();
      for (const s of swimTimes) {
        if (!(s.isPb || s.meetName !== null)) continue; // race results only -- never a practice-derived PB
        if (!s.course) continue; // course-unknown times can't be placed in either bucket
        const key = `${s.event}|${s.course}`;
        const cur = best.get(key);
        if (!cur || s.timeMs < cur.timeMs) best.set(key, { event: s.event, course: s.course, timeMs: s.timeMs, date: s.date });
      }
      return [...best.values()].sort((a, b) => (a.event === b.event ? a.course.localeCompare(b.course) : a.event.localeCompare(b.event)));
    })(),
    swimWeekly,
    zoneWeekly,
    latestSwimSession,
    takeaway: swimTakeaway(meetsWithReadiness, today),
  };
}
