import type { getAnalyticsPageDataRaw } from "@/lib/db/analyticsQuery";
import { computeMeetReadiness } from "@/lib/swim/readiness";
import { buildPacePer100Series, pacePer100Takeaway } from "@/lib/swim/pace";
import { swimTakeaway } from "@/lib/analytics/takeaways";
import { mondayOf, addDaysISO } from "@/lib/time";
import type { SwimWeek } from "@/components/analytics/SwimTrainingBlock";

type Raw = Awaited<ReturnType<typeof getAnalyticsPageDataRaw>>;

const SWIM_EVENTS_WITH_SPLITS = ["200 Breast"];
const CANONICAL_EVENTS = ["50 Breast", "100 Breast", "200 Breast", "200 IM", "400 IM"];

/** Everything the Swim page (and Analytics' overview takeaway card) derives
 * from the shared batch query — one place, so /swim and /analytics can never
 * drift apart on how swim numbers are computed. */
export function buildSwimViewModel(raw: Raw, today: string) {
  const swimTimes = raw.swimTimes;
  const swimSessions = raw.swimSessions;

  const paceSeries = buildPacePer100Series(swimSessions);
  const paceTakeaway = pacePer100Takeaway(paceSeries, today);

  const splitAutopsy = swimTimes
    .filter((s) => SWIM_EVENTS_WITH_SPLITS.includes(s.event) && s.splits && s.splits.length === 4)
    .slice(0, 5)
    .map((s) => ({ date: s.date, splits: s.splits as number[], strokeCounts: (s.strokeCounts as number[]) ?? [] }));

  const meetsWithReadiness = raw.meetsWithEvents.map((meet) => ({
    id: meet.id,
    name: meet.name,
    date: meet.date,
    events: meet.events.map((ev) => {
      const loggedTimes = swimTimes.filter((s) => s.event === ev.event).map((s) => ({ date: s.date, timeMs: s.timeMs }));
      return {
        id: ev.id,
        event: ev.event,
        currentTimeMs: ev.currentTimeMs,
        targetTimeMs: ev.targetTimeMs,
        readiness: computeMeetReadiness({ targetTimeMs: ev.targetTimeMs, loggedTimes, meetDate: meet.date, today }),
      };
    }),
  }));

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

  const latestSwimSession =
    [...swimSessions].sort((a, b) => (a.date < b.date ? 1 : -1)).find((s) => s.intervals && s.intervals.length > 0) ?? null;

  return {
    paceSeries,
    paceTakeaway,
    splitAutopsy,
    meetsWithReadiness,
    latestTimeByEvent: Object.fromEntries(latestByEvent),
    allSwimTimesByEvent: Object.fromEntries(
      allEventNames.map((ev) => [ev, swimTimes.filter((s) => s.event === ev).map((s) => ({ date: s.date, timeMs: s.timeMs }))])
    ),
    swimWeekly,
    latestSwimSession,
    takeaway: swimTakeaway(meetsWithReadiness, today),
  };
}
