import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";
import { todayManilaISO, addDaysISO } from "@/lib/time";
import { parseAnalyticsTab } from "@/lib/analytics/tabs";
import { getSettingsRow } from "@/lib/db/queries";
import { getAnalyticsPageDataRaw } from "@/lib/db/analyticsQuery";
import { bestSetE1RM } from "@/lib/train/e1rm";
import { computeDailySessionLoads, computeAcwr, computeWeeklySessions } from "@/lib/analytics/load";
import { computeWeeklyTonnage, computeWeeklyHardSets } from "@/lib/analytics/tonnage";
import { withRetry } from "@/lib/db/withRetry";
import { loadTakeaway, powerTakeaway, bodyweightTakeaway } from "@/lib/analytics/takeaways";
import { getStrengthTakeaway } from "@/lib/coach/strengthTakeaway";
import { computeKcalTarget, computeProteinTargetG } from "@/lib/fuel/targets";
import { recentPeriodStarts, periodLabel, type Period } from "@/lib/analytics/periods";
import { buildImprovementMatrix } from "@/lib/analytics/improvementMatrix";
import { buildSwimViewModel } from "@/lib/swim/viewModel";

const MAIN_LIFT_TARGETS: Record<string, { label: string; goalKg: number }> = {
  "Back squat": { label: "Back squat", goalKg: 100 },
  "Trap-bar deadlift": { label: "Trap-bar deadlift", goalKg: 130 },
};

// Every dataset the page needs from ONE round trip instead of 13 parallel
// queries fighting over the connection pool (see getAnalyticsPageDataRaw).
// Tagged "analytics-data" -- every log-writing server action revalidates
// this tag, so a warm cache is never stale after a write, only ever stale
// for the seconds between a write and its updateTag call.
// Cache key versioned (v2) because getAnalyticsPageDataRaw's column set
// changed (course/session_type/zone columns, loop 36) -- the tag alone only
// invalidates on the next log-write, so a same-day cache entry warmed before
// this deploy would otherwise keep serving rows without the new columns.
const getCachedAnalyticsPageData = unstable_cache(
  async (sinceISO: string) => getAnalyticsPageDataRaw(sinceISO),
  ["analytics-page-data-v2"],
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
  searchParams: Promise<{ period?: string; offset?: string; tab?: string }>;
}) {
  return (
    <div className="flex flex-col gap-4 pt-1">
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
  searchParams: Promise<{ period?: string; offset?: string; tab?: string }>;
}) {
  const { period: periodParam, offset: offsetParam, tab: tabParam } = await searchParams;
  // Swim graduated to its own top-level page; old ?tab=swim links follow it.
  if (tabParam === "swim") redirect("/swim");
  const period: Period = periodParam === "month" ? "month" : "week";
  const offset = Math.max(0, Number(offsetParam) || 0);
  const tab = parseAnalyticsTab(tabParam);

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
  const swimVm = buildSwimViewModel(raw, today);
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

  const e1rmByLiftObj = Object.fromEntries(e1rmByLift);
  const takeaways = {
    strength: await withRetry(() => getCachedStrengthTakeaway(today, e1rmByLiftObj)),
    load: loadTakeaway(acwr),
    power: powerTakeaway(cmjSeries, broadJumpSeries),
    bodyweight: bodyweightTakeaway(rollingAvg),
    swim: swimVm.takeaway,
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

  // Overview doorway tiles (LOOP_PHASE5_PROMPT.md P6): one oversized headline
  // stat + a 7-day sparkline per domain. Derived from data this page already
  // computes above -- no new queries.
  const lastTonnageWeek = tonnage.length > 0 ? tonnage[tonnage.length - 1] : null;
  const weeklyTonnageKg = lastTonnageWeek ? lastTonnageWeek.squat + lastTonnageWeek.hinge + lastTonnageWeek.press + lastTonnageWeek.pull : 0;
  const trainSparkline = [...dailyLoads].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-7).map((d) => d.load);

  // Race-best gap for 200 Breast at the nearest upcoming meet -- the same
  // race-only readiness math loop 26 fixed, reused rather than re-derived.
  const upcomingMeet = swimVm.meetsWithReadiness.filter((m) => m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  const swim200BrEvent = upcomingMeet?.events.find((e) => e.event === "200 Breast");
  const swimGapMs = swim200BrEvent?.readiness.gapToTargetMs ?? null;
  const swimHeadline = swimGapMs !== null ? `${swimGapMs <= 0 ? "-" : "+"}${(Math.abs(swimGapMs) / 1000).toFixed(2)}s` : "—";
  const swim200BrSparkline = [...(swimVm.allSwimTimesByEvent["200 Breast"] ?? [])]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-7)
    .map((t) => t.timeMs / 1000);

  const foodAdherence7d = [...foodByDate.entries()]
    .map(([date, entries]) => ({ date, pct: (entries.reduce((s, e) => s + e.kcal, 0) / computeKcalTarget(date).min) * 100 }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-7);
  const fuelAdherenceAvgPct =
    foodAdherence7d.length > 0 ? Math.round(foodAdherence7d.reduce((s, d) => s + d.pct, 0) / foodAdherence7d.length) : null;
  const fuelSparkline = foodAdherence7d.map((d) => d.pct);

  const sleepSortedDesc = [...sleepLogs].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastSleepHours = sleepSortedDesc.length > 0 ? Number(sleepSortedDesc[0].hours) : null;
  const recoverySparkline = sleepSortedDesc.slice(0, 7).reverse().map((s) => Number(s.hours));

  const overviewTiles = [
    {
      href: `/analytics?tab=train&period=${period}&offset=${offset}`,
      label: "Train",
      domainColor: "var(--rtd-domain-train)",
      headline: weeklyTonnageKg > 0 ? `${Math.round(weeklyTonnageKg).toLocaleString()}kg` : "—",
      sparkline: trainSparkline,
      takeaway: takeaways.strength ?? takeaways.load,
    },
    {
      href: "/swim?view=meets",
      label: "Swim",
      domainColor: "var(--rtd-domain-swim)",
      headline: swimHeadline,
      sparkline: swim200BrSparkline,
      takeaway: takeaways.swim,
    },
    {
      href: `/analytics?tab=fuel&period=${period}&offset=${offset}`,
      label: "Fuel",
      domainColor: "var(--rtd-domain-fuel)",
      headline: fuelAdherenceAvgPct !== null ? `${fuelAdherenceAvgPct}%` : "—",
      sparkline: fuelSparkline,
      takeaway: takeaways.bodyweight,
    },
    {
      href: `/analytics?tab=recovery&period=${period}&offset=${offset}`,
      label: "Recovery",
      domainColor: "var(--rtd-domain-recovery)",
      headline: lastSleepHours !== null ? `${lastSleepHours.toFixed(1)}h` : "—",
      sparkline: recoverySparkline,
      takeaway: takeaways.power,
    },
  ];

  return (
      <AnalyticsView
        today={today}
        tab={tab}
        period={period}
        offset={offset}
        currentPeriodLabel={currentPeriodLabel}
        matrixRows={matrixRows}
        takeaways={takeaways}
        overviewTiles={overviewTiles}
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
