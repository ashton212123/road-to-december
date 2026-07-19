import Link from "next/link";
import { AlertCardList } from "@/components/rules/AlertCardList";
import { NeedsAttentionList } from "@/components/home/NeedsAttentionList";
import { MoreMenuButton } from "@/components/home/MoreMenuButton";
import { CountdownHero } from "@/components/home/CountdownHero";
import { ReadinessCard } from "@/components/home/ReadinessCard";
import { TodaysPlanCard } from "@/components/home/TodaysPlanCard";
import { CoachBriefCard } from "@/components/home/CoachBriefCard";
import { WeekMapCard } from "@/components/home/WeekMapCard";
import { TrainingLoadCard } from "@/components/home/TrainingLoadCard";
import { RecentPRsCard } from "@/components/home/RecentPRsCard";
import { StatCard } from "@/components/ui/StatCard";
import { IconFuel, IconTrain } from "@/components/ui/icons";
import { seasonData } from "@/lib/data/season-data";
import { todayManilaISO, todayDayKey, daysBetween, addDaysISO, manilaHourNow, mondayOf } from "@/lib/time";
import {
  getAllPhasesWithSessions,
  getCurrentPhase,
  getLatestWeighIn,
  getWeighIns,
  getFoodLogsForDate,
  getFoodLogsSince,
  getSettingsRow,
  getUndoneBusinessTasks,
  getWorkoutLogsSince,
  getSwimSessions,
  getSleepLogs,
  getCmjTests,
  getSwimTimes,
  getMainLiftLogHistory,
} from "@/lib/db/queries";
import { computeKcalTarget, computeProteinTargetG, sevenDayAverage } from "@/lib/fuel/targets";
import { evaluateAlerts } from "@/lib/rules/engine";
import { getCanvasSummary, getUrgentAssignments, getCriticalAssignments } from "@/lib/canvas/sync";
import { computeTrainingStreak } from "@/lib/analytics/streak";
import { buildAttentionItems } from "@/lib/dashboard/needsAttention";
import { buildWeekMap } from "@/lib/dashboard/weekMap";
import { findRecentPRs } from "@/lib/dashboard/recentPRs";
import { withRetry } from "@/lib/db/withRetry";
import { getDailyBrief } from "@/lib/coach/dailyBrief";
import { computeReadinessSignals } from "@/lib/rules/readiness";
import { computeDailySessionLoads, computeAcwr } from "@/lib/analytics/load";
import { computeDailyTonnage } from "@/lib/analytics/tonnage";
import { loadTakeaway } from "@/lib/analytics/takeaways";

const DAY_KEY_TO_WEEK_INDEX: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const MORE_ROW_ITEMS = [
  { href: "/more/recovery", label: "Recovery", icon: "🌙" },
  { href: "/school", label: "School", icon: "🎓" },
  { href: "/business", label: "Business", icon: "💼" },
  { href: "/more/settings", label: "Settings", icon: "⚙️" },
];

/** % of target for an intraday metric (kcal/protein so far today) -- never
 * vs-yesterday. Null (not -100%) when nothing's logged yet: zero logged
 * isn't "100% under target", it's "no signal yet, don't show a chip." */
function intradayDeltaPct(current: number, targetMin: number): number | null {
  if (current <= 0 || targetMin <= 0) return null;
  return ((current - targetMin) / targetMin) * 100;
}

export default async function HomePage() {
  const today = todayManilaISO();
  const todayKey = todayDayKey();
  const weekStart = mondayOf(today);

  // Everything Home needs in one batched round trip -- see DECISIONS.md for
  // why this DB connection is worth being careful about. Canvas is
  // cache-only (no live sync call) so Home never blocks on it.
  const {
    canvas,
    allPhases,
    latestWeighIn,
    weighInHistory,
    todaysFood,
    settingsRow,
    alerts,
    undoneTasks,
    recentWorkoutLogs,
    recentSwimSessions,
    recentSleepLogs,
    cmjTests,
    swimTimes,
    mainLiftLogs,
    weekFoodLogs,
    // A ~14-query Promise.all batch legitimately needs more than the 8s
    // default (designed for single queries) -- that default was causing
    // withRetry to treat a merely-slow-but-succeeding batch as failed and
    // rerun all 14 queries from scratch, up to 3x, which is what actually
    // produced the "DB call timed out" cascade under load, not a real hang.
  } = await withRetry(async () => {
    const canvas = await getCanvasSummary({ sync: false });

    const settingsRowPromise = getSettingsRow();
    const todaysFoodPromise = getFoodLogsForDate(today);
    const weighIns21Promise = getWeighIns(21);
    const workoutLogsWidePromise = getWorkoutLogsSince(addDaysISO(today, -150));
    const allPhasesPromise = getAllPhasesWithSessions();
    const cmjTestsPromise = getCmjTests(20);

    const [
      allPhases,
      latestWeighIn,
      weighInHistory,
      todaysFood,
      settingsRow,
      alerts,
      undoneTasks,
      recentWorkoutLogs,
      recentSwimSessions,
      recentSleepLogs,
      cmjTests,
      swimTimes,
      mainLiftLogs,
      weekFoodLogs,
    ] = await Promise.all([
      allPhasesPromise,
      getLatestWeighIn(),
      weighIns21Promise,
      todaysFoodPromise,
      settingsRowPromise,
      Promise.all([settingsRowPromise, todaysFoodPromise, weighIns21Promise, workoutLogsWidePromise, allPhasesPromise, cmjTestsPromise]).then(
        ([settingsRow, todaysFood, weighIns21, workoutLogsWide, allPhases, cmjRows12]) =>
          evaluateAlerts(canvas, { settingsRow, todaysFood, weighIns21, workoutLogsWide, allPhases, cmjRows12 })
      ),
      getUndoneBusinessTasks(5),
      workoutLogsWidePromise,
      getSwimSessions(60),
      getSleepLogs(30),
      cmjTestsPromise,
      getSwimTimes(200),
      getMainLiftLogHistory(),
      getFoodLogsSince(weekStart),
    ]);

    return {
      canvas,
      allPhases,
      latestWeighIn,
      weighInHistory,
      todaysFood,
      settingsRow,
      alerts,
      undoneTasks,
      recentWorkoutLogs,
      recentSwimSessions,
      recentSleepLogs,
      cmjTests,
      swimTimes,
      mainLiftLogs,
      weekFoodLogs,
    };
  }, { timeoutMs: 15000 });

  const criticalIds = new Set(getCriticalAssignments(canvas.assignments).map((a) => a.id));
  const urgentAssignments = getUrgentAssignments(canvas.assignments)
    .filter((a) => !criticalIds.has(a.id))
    .slice(0, 5);
  const trainingStreak = computeTrainingStreak({
    today,
    phases: allPhases,
    loggedDates: new Set(recentWorkoutLogs.map((l) => l.date)),
  });

  const currentPhase = getCurrentPhase(allPhases, today) ?? allPhases[0];
  const seasonStart = seasonData.meta.seasonStart;
  const seasonEnd = seasonData.meta.seasonEnd;
  const seasonPct = Math.min(
    100,
    Math.max(0, Math.round((daysBetween(seasonStart, today) / daysBetween(seasonStart, seasonEnd)) * 100))
  );
  const weekNumber = Math.max(1, Math.floor(daysBetween(seasonStart, today) / 7) + 1);
  const daysToNcaa = Math.max(0, daysBetween(today, seasonData.meta.targets.ncaaDate));
  const daysToAsean = Math.max(0, daysBetween(today, seasonData.meta.targets.aseanDate));
  const aseanDateLabel = new Date(seasonData.meta.targets.aseanDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const aseanLabel =
    settingsRow.aseanConfirmed === true
      ? `ASEAN confirmed — ~${aseanDateLabel}`
      : settingsRow.aseanConfirmed === false
        ? "ASEAN cancelled — full taper into NCAA"
        : `ASEAN unconfirmed — ~${aseanDateLabel} if it happens`;

  const weekDay = seasonData.WEEK[DAY_KEY_TO_WEEK_INDEX[todayKey]];
  const todaySession = currentPhase.sessions.find((s) => s.dayKey === todayKey) ?? null;

  const kcalTarget = computeKcalTarget(today);
  const proteinAvgWeight = sevenDayAverage(weighInHistory) ?? Number(latestWeighIn?.kg ?? 63);
  const proteinTarget = computeProteinTargetG(proteinAvgWeight);
  const kcalToday = todaysFood.reduce((sum, f) => sum + f.kcal, 0);
  const proteinToday = todaysFood.reduce((sum, f) => sum + Number(f.proteinG), 0);

  const weightSeries = [...weighInHistory].sort((a, b) => (a.date < b.date ? -1 : 1));
  const weightTrend =
    weighInHistory.length >= 2 ? Number(weighInHistory[0].kg) - Number(weighInHistory[1].kg) : null;
  const weightTrendPct = weightTrend !== null && weighInHistory[1] ? (weightTrend / Number(weighInHistory[1].kg)) * 100 : null;

  const hour = manilaHourNow();
  const loggedWorkoutToday = recentWorkoutLogs.some((l) => l.date === today);
  const loggedSwimToday = recentSwimSessions.some((s) => s.date === today);
  const needsAttention = buildAttentionItems({
    today,
    todayKey,
    hour,
    currentPhaseId: currentPhase.id,
    todaySession,
    weekDay,
    loggedWorkoutToday,
    loggedSwimSessionToday: loggedSwimToday,
    foodLoggedTodayCount: todaysFood.length,
    sleepLoggedToday: recentSleepLogs.some((s) => s.date === today),
    undoneBusinessTasks: undoneTasks,
    urgentSchoolAssignments: urgentAssignments,
  });

  const dailyBrief = await withRetry(() =>
    getDailyBrief({
      today,
      athleteWeightKg: latestWeighIn ? Number(latestWeighIn.kg) : null,
      weightTrendKg: weightTrend,
      kcalToday,
      kcalTargetMin: kcalTarget.min,
      kcalTargetMax: kcalTarget.max,
      proteinToday,
      proteinTargetMin: proteinTarget.min,
      trainingStreak,
      todaySessionTitle: todaySession?.title ?? null,
      todaySwim: weekDay.swim ?? null,
      daysToNcaa,
      daysToAsean: settingsRow.aseanConfirmed === false ? null : daysToAsean,
      phaseTag: currentPhase.tag,
      phaseName: currentPhase.name,
      loggedWorkoutToday,
      loggedSwimToday,
      activeAlertHeadlines: alerts.map((a) => a.title),
    })
  );

  // Readiness -- same three transparent inputs as the Recovery page.
  const lastSleep = recentSleepLogs[0] ? Number(recentSleepLogs[0].hours) : null;
  const cmjSorted = [...cmjTests].sort((a, b) => (a.date < b.date ? -1 : 1));
  const cmjTrend: "up" | "flat" | "down" | "insufficient-data" =
    cmjSorted.length < 2
      ? "insufficient-data"
      : Number(cmjSorted[cmjSorted.length - 1].bestOf3Cm) > Number(cmjSorted[cmjSorted.length - 2].bestOf3Cm)
        ? "up"
        : Number(cmjSorted[cmjSorted.length - 1].bestOf3Cm) < Number(cmjSorted[cmjSorted.length - 2].bestOf3Cm)
          ? "down"
          : "flat";
  const dailyLoads = computeDailySessionLoads(recentWorkoutLogs);
  const acwr = computeAcwr(dailyLoads);
  const latestRatio = acwr.length > 0 ? acwr[acwr.length - 1].ratio : null;
  const readinessSignals = computeReadinessSignals({ lastSleepHours: lastSleep, cmjTrend, acwrRatio: latestRatio });
  const readinessOverall = readinessSignals.some((s) => s.light === "red")
    ? "red"
    : readinessSignals.some((s) => s.light === "yellow")
      ? "yellow"
      : ("green" as const);

  // Today's plan rows -- status reflects real logged state, never fabricated.
  const planRows = [];
  if (weekDay.swim) {
    planRows.push({
      key: "swim",
      time: weekDay.swim,
      title: "Swim",
      done: loggedSwimToday,
      href: "/analytics?tab=swim",
      color: "var(--rtd-domain-swim)",
    });
  }
  if (todaySession) {
    planRows.push({
      key: "gym",
      time: null,
      title: todaySession.title,
      done: loggedWorkoutToday,
      href: `/train/${currentPhase.id}?day=${todayKey}`,
      color: "var(--rtd-domain-train)",
    });
  }
  const startHref = todaySession && !loggedWorkoutToday ? `/train/${currentPhase.id}?day=${todayKey}` : null;

  // Week map: Mon..Sun of the current week across Swim/Gym/Fuel/Sleep.
  const scheduledSwimDays = new Set(
    [0, 1, 2, 3, 4, 5, 6]
      .filter((i) => seasonData.WEEK[i].swim)
      .map((i) => addDaysISO(weekStart, i))
  );
  const scheduledGymDays = new Set(
    currentPhase.sessions.map((s) => addDaysISO(weekStart, DAY_KEY_TO_WEEK_INDEX[s.dayKey]))
  );
  const weekMap = buildWeekMap({
    today,
    weekStartISO: weekStart,
    scheduledSwimDays,
    scheduledGymDays,
    loggedSwimDates: new Set(recentSwimSessions.map((s) => s.date)),
    loggedGymDates: new Set(recentWorkoutLogs.map((l) => l.date)),
    loggedFoodDates: new Set(weekFoodLogs.map((f) => f.date)),
    loggedSleepDates: new Set(recentSleepLogs.map((s) => s.date)),
  });

  // Training load: daily tonnage this week vs last week (dashed), same ACWR
  // takeaway Analytics uses. null (not 0) for days with no lift logged --
  // ComparisonLine breaks the line there instead of drawing a fake dip to zero.
  const dailyTonnage = computeDailyTonnage(mainLiftLogs);
  const thisWeekDaily = Array.from({ length: 7 }, (_, i) => dailyTonnage.get(addDaysISO(weekStart, i)) ?? null);
  const lastWeekDaily = Array.from({ length: 7 }, (_, i) => dailyTonnage.get(addDaysISO(weekStart, i - 7)) ?? null);
  const trainingLoadTakeaway = loadTakeaway(acwr);

  const recentPRs = findRecentPRs({ mainLiftLogs, swimTimes, cmjTests });

  const weekSessionsPlanned = currentPhase.sessions.length;
  const weekSessionsDone = new Set(
    [...recentWorkoutLogs.map((l) => l.date)].filter((d) => d >= weekStart && d <= today)
  ).size;

  const followUps = [
    todaySession ? `What should I focus on in ${todaySession.title}?` : "How's my training this week?",
    "How's my nutrition looking today?",
  ];

  return (
    <div className="flex flex-col gap-3 rtd-fade-in pt-1">
      <div className="flex items-center justify-between md:hidden">
        <span className="text-title-3 font-semibold text-[var(--rtd-text)]">Home</span>
        <MoreMenuButton />
      </div>

      <AlertCardList alerts={alerts} />

      <div className="rtd-bento-grid">
        <CountdownHero
          daysToNcaa={daysToNcaa}
          daysToAsean={daysToAsean}
          aseanLabel={aseanLabel}
          aseanDateLabel={aseanDateLabel}
          aseanConfirmed={settingsRow.aseanConfirmed}
          seasonPct={seasonPct}
          phaseTag={currentPhase.tag}
          phaseName={currentPhase.name}
          weekNumber={weekNumber}
          trainingStreak={trainingStreak}
        />
        <ReadinessCard overall={readinessOverall} signals={readinessSignals} />

        <StatCard
          label="Kcal today"
          numericValue={kcalToday}
          domainColor="var(--rtd-domain-fuel)"
          icon={<IconFuel />}
          sub={`of ${kcalTarget.min}–${kcalTarget.max}`}
          deltaPct={intradayDeltaPct(kcalToday, kcalTarget.min)}
          className="col-span-3 row-span-2"
        />
        <StatCard
          label="Protein today"
          numericValue={Math.round(proteinToday)}
          suffix="g"
          domainColor="var(--rtd-green)"
          sub={`of ${proteinTarget.min}–${proteinTarget.max}g`}
          deltaPct={intradayDeltaPct(proteinToday, proteinTarget.min)}
          className="col-span-3 row-span-2"
        />
        <StatCard
          label="Bodyweight (7d)"
          numericValue={latestWeighIn ? Number(latestWeighIn.kg) : 0}
          decimals={1}
          suffix=" kg"
          domainColor="var(--rtd-cyan)"
          deltaPct={weightTrendPct}
          goodDirection="up"
          sparklinePoints={weightSeries.slice(-14).map((w) => Number(w.kg))}
          className="col-span-3 row-span-2"
        />
        <StatCard
          label="Week completion"
          value={`${weekSessionsDone}/${weekSessionsPlanned}`}
          domainColor="var(--rtd-blue)"
          icon={<IconTrain />}
          sub={`${trainingStreak} day streak`}
          className="col-span-3 row-span-2"
        />

        <TodaysPlanCard rows={planRows} startHref={startHref} />
        <CoachBriefCard brief={dailyBrief} followUps={followUps} />
        {needsAttention.length > 0 ? (
          <NeedsAttentionList items={needsAttention} className="col-span-3 row-span-3 h-full" />
        ) : (
          <div className="rtd-glass rtd-bento-card flex items-center justify-center p-5" style={{ gridColumn: "span 3 / span 3", gridRow: "span 3 / span 3" }}>
            <span className="text-caption text-[var(--rtd-text-tertiary)] text-center">Nothing needs attention right now</span>
          </div>
        )}

        <WeekMapCard days={weekMap.days} rows={weekMap.rows} />
        <TrainingLoadCard thisWeekDaily={thisWeekDaily} lastWeekDaily={lastWeekDaily} takeaway={trainingLoadTakeaway} />
        <RecentPRsCard prs={recentPRs} />
      </div>

      {/* Mobile: single-column stack, same modules, spec's priority order. */}
      <div className="flex flex-col gap-3 md:hidden">
        <CountdownHero
          daysToNcaa={daysToNcaa}
          daysToAsean={daysToAsean}
          aseanLabel={aseanLabel}
          aseanDateLabel={aseanDateLabel}
          aseanConfirmed={settingsRow.aseanConfirmed}
          seasonPct={seasonPct}
          phaseTag={currentPhase.tag}
          phaseName={currentPhase.name}
          weekNumber={weekNumber}
          trainingStreak={trainingStreak}
        />
        <ReadinessCard overall={readinessOverall} signals={readinessSignals} />
        <TodaysPlanCard rows={planRows} startHref={startHref} />
        <CoachBriefCard brief={dailyBrief} followUps={followUps} />
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Kcal today"
            numericValue={kcalToday}
            domainColor="var(--rtd-domain-fuel)"
            icon={<IconFuel />}
            sub={`of ${kcalTarget.min}–${kcalTarget.max}`}
            deltaPct={intradayDeltaPct(kcalToday, kcalTarget.min)}
          />
          <StatCard
            label="Protein today"
            numericValue={Math.round(proteinToday)}
            suffix="g"
            domainColor="var(--rtd-green)"
            sub={`of ${proteinTarget.min}–${proteinTarget.max}g`}
            deltaPct={intradayDeltaPct(proteinToday, proteinTarget.min)}
          />
          <StatCard
            label="Bodyweight (7d)"
            numericValue={latestWeighIn ? Number(latestWeighIn.kg) : 0}
            decimals={1}
            suffix=" kg"
            domainColor="var(--rtd-cyan)"
            deltaPct={weightTrendPct}
            goodDirection="up"
            sparklinePoints={weightSeries.slice(-14).map((w) => Number(w.kg))}
          />
          <StatCard
            label="Week completion"
            value={`${weekSessionsDone}/${weekSessionsPlanned}`}
            domainColor="var(--rtd-blue)"
            icon={<IconTrain />}
            sub={`${trainingStreak} day streak`}
          />
        </div>
        {needsAttention.length > 0 && <NeedsAttentionList items={needsAttention} />}
        <WeekMapCard days={weekMap.days} rows={weekMap.rows} />
        <TrainingLoadCard thisWeekDaily={thisWeekDaily} lastWeekDaily={lastWeekDaily} takeaway={trainingLoadTakeaway} />
        <RecentPRsCard prs={recentPRs} />

        <div className="grid grid-cols-4 gap-2 mt-1">
          {MORE_ROW_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rtd-glass flex flex-col items-center gap-1 py-3 cursor-pointer hover:brightness-110 active:scale-[0.98] transition-transform duration-150 ease-out"
            >
              <span className="text-lg" aria-hidden="true">{item.icon}</span>
              <span className="text-caption text-[var(--rtd-text-secondary)]">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
