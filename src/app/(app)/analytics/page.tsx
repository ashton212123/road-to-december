import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";
import { seasonData } from "@/lib/data/season-data";
import { todayManilaISO, addDaysISO } from "@/lib/time";
import { getSettingsRow } from "@/lib/db/queries";
import { getAnalyticsPageDataRaw } from "@/lib/db/analyticsQuery";
import { bestSetE1RM } from "@/lib/train/e1rm";
import { computeDailySessionLoads, computeAcwr, computeWeeklySessions } from "@/lib/analytics/load";
import { computeWeeklyTonnage, computeWeeklyHardSets } from "@/lib/analytics/tonnage";
import { computeMeetReadiness } from "@/lib/swim/readiness";
import { withRetry } from "@/lib/db/withRetry";
import { loadTakeaway, powerTakeaway, bodyweightTakeaway, swimTakeaway } from "@/lib/analytics/takeaways";
import { getStrengthTakeaway } from "@/lib/coach/strengthTakeaway";
import { computeKcalTarget, computeProteinTargetG } from "@/lib/fuel/targets";
import { recentPeriodStarts, periodLabel, type Period } from "@/lib/analytics/periods";
import { buildImprovementMatrix } from "@/lib/analytics/improvementMatrix";

const MAIN_LIFT_TARGETS: Record<string, { label: string; goalKg: number }> = {
  "Back squat": { label: "Back squat", goalKg: 100 },
  "Trap-bar deadlift": { label: "Trap-bar deadlift", goalKg: 130 },
};

// Every dataset the page needs from ONE round trip instead of 13 parallel
// queries fighting over the connection pool (see getAnalyticsPageDataRaw).
// Tagged "analytics-data" -- every log-writing server action revalidates
// this tag, so a warm cache is never stale after a write, only ever stale
// for the seconds between a write and its updateTag call.
const getCachedAnalyticsPageData = unstable_cache(
  async (sinceISO: string) => getAnalyticsPageDataRaw(sinceISO),
  ["analytics-page-data"],
  { tags: ["analytics-data"] }
);

// getStrengthTakeaway already self-caches per-day at the DB level (see its
// own doc comment) -- this layer just skips the redundant SELECT on repeat
// warm loads within the same day, same tag so a new lift log still surfaces
// a regenerated takeaway on the next cache-busted load.
const getCachedStrengthTakeaway = unstable_cache(getStrengthTakeaway, ["strength-takeaway"], {
  tags: ["analytics-data"],
});

export default function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; offset?: string }>;
}) {
  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1">
      <SectionLabel>Analytics</SectionLabel>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

// The page shell above (header + Suspense boundary) paints on navigation
// before this ever resolves -- everything that actually waits on the DB
// round trip lives here so "cold nav paints instantly" doesn't depend on
// the query being fast, only on the shell being static.
async function AnalyticsContent({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; offset?: string }>;
}) {
  const { period: periodParam, offset: offsetParam } = await searchParams;
  const period: Period = periodParam === "month" ? "month" : "week";
  const offset = Math.max(0, Number(offsetParam) || 0);

  const today = todayManilaISO();
  const since = addDaysISO(today, -180);

  const raw = await withRetry(() => getCachedAnalyticsPageData(since), { timeoutMs: 15000 });
  const mainLiftLogs = raw.mainLiftLogs;
  const weighIns = raw.weighIns;
  const cmjTests = raw.cmjTests;
  // getJumpTests's original behavior: top-30 most-recent jump tests of ANY
  // type, filtered to broad_jump after the fact -- not "30 most recent
  // broad_jump rows". Preserved exactly so a run of seated-box tests can't
  // silently change how far back the broad-jump series reaches.
  const broadJumps = raw.jumpTestsRaw.filter((j) => j.type === "broad_jump");
  const swimTimes = raw.swimTimes;
  const timeTo15m = raw.timeTo15m;
  const meetsWithEvents = raw.meetsWithEvents;
  const swimSessions = raw.swimSessions;
  const foodLogs = raw.foodLogs;
  const sleepLogs = raw.sleepLogs;
  const sorenessLogs = raw.sorenessLogs;
  const waterLogs = raw.waterLogs;
  const settingsRow = raw.settingsRow ?? (await getSettingsRow());

  // Strength: best-set e1RM per main lift per date it was logged.
  const e1rmByLift = new Map<string, { date: string; e1rm: number }[]>();
  const byLiftDate = new Map<string, Map<string, { weightKg: number | null; reps: number | null }[]>>();
  for (const log of mainLiftLogs) {
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
    e1rmByLift.set(lift, points);
  }

  const tonnage = computeWeeklyTonnage(mainLiftLogs);
  const hardSets = computeWeeklyHardSets(mainLiftLogs);
  const dailyLoads = computeDailySessionLoads(mainLiftLogs);
  const acwr = computeAcwr(dailyLoads);
  const weeklySessions = computeWeeklySessions(dailyLoads);

  const cmjSeries = [...cmjTests]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((t) => ({ date: t.date, cm: Number(t.bestOf3Cm) }));
  const broadJumpSeries = [...broadJumps]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((t) => ({ date: t.date, cm: Number(t.valueCm) }));

  const weightSeries = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const rollingAvg = weightSeries.map((w, i) => {
    const window = weightSeries.slice(Math.max(0, i - 6), i + 1);
    const avg = window.reduce((s, x) => s + Number(x.kg), 0) / window.length;
    return { date: w.date, kg: Number(w.kg), avg7: Math.round(avg * 100) / 100 };
  });

  const swimEvents = ["200 Breast"];
  const splitAutopsy = swimTimes
    .filter((s) => swimEvents.includes(s.event) && s.splits && s.splits.length === 4)
    .slice(0, 5)
    .map((s) => ({ date: s.date, splits: s.splits as number[], strokeCounts: (s.strokeCounts as number[]) ?? [] }));

  const meetsWithReadiness = meetsWithEvents.map((meet) => ({
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

  const CANONICAL_EVENTS = ["50 Breast", "100 Breast", "200 Breast", "200 IM", "400 IM"];
  const allEventNames = [...new Set([...CANONICAL_EVENTS, ...swimTimes.map((s) => s.event)])];

  const e1rmByLiftObj = Object.fromEntries(e1rmByLift);
  const takeaways = {
    strength: await withRetry(() => getCachedStrengthTakeaway(today, e1rmByLiftObj)),
    load: loadTakeaway(acwr),
    power: powerTakeaway(cmjSeries, broadJumpSeries),
    bodyweight: bodyweightTakeaway(rollingAvg),
    swim: swimTakeaway(meetsWithReadiness, today),
  };

  // Improvement matrix: one row per tracked metric, aggregated by the
  // selected week/month period, with a plain daily-adherence-% approximation
  // for kcal/protein (target computed per-day for kcal since it varies at
  // the bulk-window boundary; protein target uses the latest known weight --
  // exact historical weight-at-the-time isn't worth the extra complexity at
  // this scale).
  const latestWeightKg = weightSeries.length > 0 ? Number(weightSeries[weightSeries.length - 1].kg) : 63;
  const proteinTargetMin = computeProteinTargetG(latestWeightKg).min;
  const foodByDate = new Map<string, { kcal: number; proteinG: number }[]>();
  for (const f of foodLogs) {
    if (!foodByDate.has(f.date)) foodByDate.set(f.date, []);
    foodByDate.get(f.date)!.push({ kcal: f.kcal, proteinG: Number(f.proteinG) });
  }
  const kcalAdherenceDaily: { date: string; pct: number }[] = [];
  const proteinAdherenceDaily: { date: string; pct: number }[] = [];
  for (const [date, entries] of foodByDate) {
    const kcalTotal = entries.reduce((s, e) => s + e.kcal, 0);
    const proteinTotal = entries.reduce((s, e) => s + e.proteinG, 0);
    const kcalTargetForDay = computeKcalTarget(date).min;
    kcalAdherenceDaily.push({ date, pct: (kcalTotal / kcalTargetForDay) * 100 });
    proteinAdherenceDaily.push({ date, pct: (proteinTotal / proteinTargetMin) * 100 });
  }
  const waterByDate = new Map<string, number>();
  for (const w of waterLogs) waterByDate.set(w.date, (waterByDate.get(w.date) ?? 0) + w.ml);

  const periodStarts = recentPeriodStarts(today, period, 10, offset);
  const matrixRows = buildImprovementMatrix({
    period,
    todayISO: today,
    periodStarts,
    mainLiftLogs,
    swimTimes,
    weighIns,
    cmjTests,
    sleepLogs,
    waterLogsDaily: [...waterByDate.entries()].map(([date, ml]) => ({ date, ml })),
    proteinAdherenceDaily,
    kcalAdherenceDaily,
    gymSessionDates: [...new Set(mainLiftLogs.map((l) => l.date))],
    waterTargetMl: settingsRow.waterTargetMl,
  });
  const currentPeriodLabel = periodLabel(periodStarts[periodStarts.length - 1], period);

  return (
      <AnalyticsView
        today={today}
        period={period}
        offset={offset}
        currentPeriodLabel={currentPeriodLabel}
        matrixRows={matrixRows}
        takeaways={takeaways}
        e1rmByLift={e1rmByLiftObj}
        liftTargets={MAIN_LIFT_TARGETS}
        tonnage={tonnage}
        hardSets={hardSets}
        dailyLoads={dailyLoads}
        acwr={acwr}
        weeklySessions={weeklySessions}
        cmjSeries={cmjSeries}
        broadJumpSeries={broadJumpSeries}
        weightSeries={rollingAvg}
        pbRows={seasonData.PB_ROWS}
        targets={seasonData.TARGETS}
        splitBars={seasonData.SPLIT_BARS}
        splitAutopsy={splitAutopsy}
        timeTo15m={timeTo15m.map((t) => ({ date: t.date, seconds: Number(t.seconds), condition: t.condition }))}
        recentSwimTimes={swimTimes.slice(0, 50).map((t) => ({ id: t.id, date: t.date, event: t.event, timeMs: t.timeMs, meetName: t.meetName }))}
        allSwimTimesByEvent={Object.fromEntries(
          allEventNames.map((ev) => [ev, swimTimes.filter((s) => s.event === ev).map((s) => ({ date: s.date, timeMs: s.timeMs }))])
        )}
        meets={meetsWithReadiness}
        latestTimeByEvent={Object.fromEntries(latestByEvent)}
        swimSessions={swimSessions.map((s) => ({ id: s.id, date: s.date, loadRating: s.loadRating, setsText: s.setsText, parsedDistanceM: s.parsedDistanceM }))}
        sorenessLogs={sorenessLogs.map((s) => ({ id: s.id, date: s.date, area: s.area, rating1to5: s.rating1to5 }))}
        sleepLogs={sleepLogs.slice(0, 30).map((s) => ({ date: s.date, hours: Number(s.hours) }))}
        foodAdherenceByDate={[...foodByDate.entries()].map(([date, entries]) => ({
          date,
          kcal: entries.reduce((s, e) => s + e.kcal, 0),
          kcalTargetMin: computeKcalTarget(date).min,
        }))}
      />
  );
}
