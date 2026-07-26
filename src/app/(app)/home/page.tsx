import Link from "next/link";
import { unstable_cache } from "next/cache";
import { AlertCardList } from "@/components/rules/AlertCardList";
import { NeedsAttentionList } from "@/components/home/NeedsAttentionList";
import { MoreMenuButton } from "@/components/home/MoreMenuButton";
import { QuickLogSheet } from "@/components/home/QuickLogSheet";
import { HomeHeroBand } from "@/components/home/HomeHeroBand";
import { HomeDoorwayDials } from "@/components/home/HomeDoorwayDials";
import { MonthCalendarCard } from "@/components/home/MonthCalendarCard";
import { FuelRingCard } from "@/components/home/FuelRingCard";
import { TodaysPlanCard } from "@/components/home/TodaysPlanCard";
import { CoachBriefCard } from "@/components/home/CoachBriefCard";
import { WeekMapCard } from "@/components/home/WeekMapCard";
import { TrainingLoadCard } from "@/components/home/TrainingLoadCard";
import { RecentPRsCard } from "@/components/home/RecentPRsCard";
import { StatCard } from "@/components/ui/StatCard";
import { IconTrain } from "@/components/ui/icons";
import { seasonData } from "@/lib/data/season-data";
import { todayManilaISO, todayDayKey, dayKeyForDate, daysBetween, addDaysISO, manilaHourNow, mondayOf } from "@/lib/time";
import {
  getAllPhasesWithSessions,
  getCurrentPhase,
  getLatestWeighIn,
  getWeighIns,
  getFoodLogsForDate,
  getFoodLogsSince,
  getWaterLogsForDate,
  getSettingsRow,
  getUndoneBusinessTasks,
  getWorkoutLogsSince,
  getSwimSessions,
  getSleepLogs,
  getCmjTests,
  getSwimTimes,
  getMainLiftLogHistory,
  getSorenessLogs,
  getSessionLoadsSince,
} from "@/lib/db/queries";
import { computeKcalTarget, computeProteinTargetG, computeCarbsAndFatTargetG, sevenDayAverage } from "@/lib/fuel/targets";
import { evaluateAlerts } from "@/lib/rules/engine";
import { getCanvasSummary, getUrgentAssignments, getCriticalAssignments } from "@/lib/canvas/sync";
import { computeConsistencyPct } from "@/lib/analytics/streak";
import { applyTrainingStatusCap, readinessActionLine } from "@/lib/rules/readinessTone";
import { buildAttentionItems } from "@/lib/dashboard/needsAttention";
import { buildWeekMap } from "@/lib/dashboard/weekMap";
import { findRecentPRs } from "@/lib/dashboard/recentPRs";
import { withRetry } from "@/lib/db/withRetry";
import { getDailyBrief } from "@/lib/coach/dailyBrief";
import { computeReadinessSignals } from "@/lib/rules/readiness";
import { computeDailySessionLoads, computeAcwr, computeWeeklyLoad, computeWeekOverWeekRamp } from "@/lib/analytics/load";
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
  { href: "/more/coach-ai", label: "Coach", icon: "✨" },
  { href: "/more/recovery", label: "Recovery", icon: "🌙" },
  { href: "/learn", label: "Learn", icon: "📚" },
  { href: "/school", label: "School", icon: "🎓" },
  { href: "/business", label: "Business", icon: "💼" },
  { href: "/more/settings", label: "Settings", icon: "⚙️" },
];

// Every DB read Home needs, cached and tagged "home-data" -- every log-
// writing server action revalidates this tag. evaluateAlerts is
// deliberately NOT called in here: it reads the wall-clock hour internally
// (some alerts only fire after a threshold hour), so it has to run fresh on
// every request against these cached raw rows, not get frozen at whatever
// hour first populated the cache.
// Key versioned (v2, loop 37) because this function's returned shape gained
// sessionLoads -- same reasoning as analytics/page.tsx's cache key: the tag
// alone doesn't invalidate a same-day entry warmed before this deploy.
const getCachedHomeData = unstable_cache(
  async (today: string, weekStart: string) => {
    const canvas = await getCanvasSummary({ sync: false });

    const [
      allPhases,
      latestWeighIn,
      weighInHistory,
      todaysFood,
      todaysWater,
      settingsRow,
      undoneTasks,
      recentWorkoutLogs,
      recentSwimSessions,
      recentSleepLogs,
      cmjTests,
      swimTimes,
      mainLiftLogs,
      weekFoodLogs,
      sorenessLogs,
      sessionLoads,
    ] = await Promise.all([
      getAllPhasesWithSessions(),
      getLatestWeighIn(),
      getWeighIns(21),
      getFoodLogsForDate(today),
      getWaterLogsForDate(today),
      getSettingsRow(),
      getUndoneBusinessTasks(5),
      getWorkoutLogsSince(addDaysISO(today, -150)),
      getSwimSessions(60),
      getSleepLogs(30),
      getCmjTests(30),
      getSwimTimes(200),
      getMainLiftLogHistory(),
      getFoodLogsSince(weekStart),
      getSorenessLogs(1),
      getSessionLoadsSince(addDaysISO(today, -150)),
    ]);

    return {
      canvas,
      allPhases,
      latestWeighIn,
      weighInHistory,
      todaysFood,
      todaysWater,
      settingsRow,
      undoneTasks,
      recentWorkoutLogs,
      recentSwimSessions,
      recentSleepLogs,
      cmjTests,
      swimTimes,
      mainLiftLogs,
      weekFoodLogs,
      sorenessLogs,
      sessionLoads,
    };
  },
  ["home-page-data-v2"],
  { tags: ["home-data"] }
);

export default async function HomePage() {
  const today = todayManilaISO();
  const todayKey = todayDayKey();
  const weekStart = mondayOf(today);

  const {
    canvas,
    allPhases,
    latestWeighIn,
    weighInHistory,
    todaysFood,
    todaysWater,
    settingsRow,
    undoneTasks,
    recentWorkoutLogs,
    recentSwimSessions,
    recentSleepLogs,
    cmjTests,
    swimTimes,
    mainLiftLogs,
    weekFoodLogs,
    sorenessLogs,
    sessionLoads,
  } = await withRetry(() => getCachedHomeData(today, weekStart), { timeoutMs: 15000 });

  const alerts = await evaluateAlerts(canvas, {
    settingsRow,
    todaysFood,
    weighIns21: weighInHistory,
    workoutLogsWide: recentWorkoutLogs,
    allPhases,
    cmjRows12: cmjTests,
  });

  const criticalIds = new Set(getCriticalAssignments(canvas.assignments).map((a) => a.id));
  const urgentAssignments = getUrgentAssignments(canvas.assignments)
    .filter((a) => !criticalIds.has(a.id))
    .slice(0, 5);
  const consistency = computeConsistencyPct({
    today,
    phases: allPhases,
    loggedDates: new Set(recentWorkoutLogs.map((l) => l.date)),
    excusedFromISO: settingsRow.trainingStatus === "healthy" ? null : settingsRow.trainingStatusSince,
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
  const carbsToday = todaysFood.reduce((sum, f) => sum + Number(f.carbsG ?? 0), 0);
  const fatToday = todaysFood.reduce((sum, f) => sum + Number(f.fatG ?? 0), 0);
  const carbsFatTarget = computeCarbsAndFatTargetG(kcalTarget.mid, proteinTarget.mid);
  const waterToday = todaysWater.reduce((sum, w) => sum + w.ml, 0);

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
      consistencyPct: consistency.pct,
      todaySessionTitle: todaySession?.title ?? null,
      todaySwim: weekDay.swim ?? null,
      daysToNcaa,
      daysToAsean: settingsRow.aseanConfirmed === false ? null : daysToAsean,
      trainingStatus: settingsRow.trainingStatus,
      trainingStatusSince: settingsRow.trainingStatusSince,
      phaseTag: currentPhase.tag,
      phaseName: currentPhase.name,
      loggedWorkoutToday,
      loggedSwimToday,
      activeAlertHeadlines: alerts.map((a) => a.title),
    })
  );

  // Readiness -- same transparent inputs as the Recovery page (loop 37
  // rebuild, G5): ACWR is out, CMJ compares to a 4-week baseline instead of
  // one prior test, weekly load ramp and breast-kick ramp are new.
  const lastSleep = recentSleepLogs[0] ? Number(recentSleepLogs[0].hours) : null;

  const cmjSorted = [...cmjTests].sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  const cmjLatestCm = cmjSorted.length > 0 ? Number(cmjSorted[0].bestOf3Cm) : null;
  const cmjBaselineWindow = cmjSorted.slice(1).filter((t) => t.date >= addDaysISO(today, -28));
  const cmjBaselineCm =
    cmjBaselineWindow.length > 0 ? cmjBaselineWindow.reduce((s, t) => s + Number(t.bestOf3Cm), 0) / cmjBaselineWindow.length : null;

  const dailyLoads = computeDailySessionLoads({
    sessionLoads: sessionLoads.map((s) => ({ date: s.date, kind: s.kind, load: s.load })),
    workoutLogs: recentWorkoutLogs,
  });
  const acwr = computeAcwr(dailyLoads);
  const weeklyLoad = computeWeeklyLoad(dailyLoads);
  const loadRamp = computeWeekOverWeekRamp(weeklyLoad);
  const latestRampPct = loadRamp.length > 0 ? loadRamp[loadRamp.length - 1].pctChange : null;

  const breastKickByWeek = new Map<string, number>();
  for (const s of recentSwimSessions) {
    const wk = mondayOf(s.date);
    breastKickByWeek.set(wk, (breastKickByWeek.get(wk) ?? 0) + (s.breastKickM ?? 0));
  }
  const thisWeekBreastKickM = breastKickByWeek.get(weekStart) ?? 0;
  const priorBreastKickWeeks = Array.from({ length: 4 }, (_, i) => breastKickByWeek.get(addDaysISO(weekStart, -7 * (i + 1))) ?? 0);
  const priorBreastKickWithData = priorBreastKickWeeks.filter((m) => m > 0);
  const breastKickBaselineM =
    priorBreastKickWithData.length > 0 ? priorBreastKickWithData.reduce((a, b) => a + b, 0) / priorBreastKickWithData.length : null;
  const breastKickRatio = breastKickBaselineM !== null && breastKickBaselineM > 0 ? thisWeekBreastKickM / breastKickBaselineM : null;

  const latestSoreness = sorenessLogs[0];
  const recentSoreness =
    latestSoreness && (latestSoreness.date === today || latestSoreness.date === addDaysISO(today, -1))
      ? { rating: latestSoreness.rating1to5, area: latestSoreness.area, date: latestSoreness.date }
      : null;
  const readinessSignals = computeReadinessSignals({
    lastSleepHours: lastSleep,
    cmjLatestCm,
    cmjBaselineCm,
    weeklyLoadRampPct: latestRampPct,
    breastKickRatio,
    recentSoreness,
  });
  const readinessComputed = readinessSignals.some((s) => s.light === "red")
    ? "red"
    : readinessSignals.some((s) => s.light === "yellow")
      ? "yellow"
      : ("green" as const);
  const readinessOverall = applyTrainingStatusCap(readinessComputed, settingsRow.trainingStatus);
  const readinessActionLineText = readinessActionLine(readinessComputed, settingsRow.trainingStatus);

  // Today's plan rows -- status reflects real logged state, never fabricated.
  const planRows = [];
  if (weekDay.swim) {
    planRows.push({
      key: "swim",
      time: weekDay.swim,
      title: "Swim",
      done: loggedSwimToday,
      href: "/swim",
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

  // Rest-day preview: only ever rendered when planRows is empty, but cheap
  // enough to always compute -- tomorrow can land in a different phase than
  // today near a phase boundary, so re-resolve it rather than assuming
  // currentPhase still applies.
  const tomorrowISO = addDaysISO(today, 1);
  const tomorrowKey = dayKeyForDate(tomorrowISO);
  const tomorrowWeekDay = seasonData.WEEK[DAY_KEY_TO_WEEK_INDEX[tomorrowKey]];
  const tomorrowPhase = getCurrentPhase(allPhases, tomorrowISO) ?? currentPhase;
  const tomorrowSession = tomorrowPhase.sessions.find((s) => s.dayKey === tomorrowKey) ?? null;
  const tomorrowPreview = tomorrowSession
    ? {
        title: tomorrowSession.title,
        time: null,
        exercises: tomorrowSession.exercises.slice(0, 3).map((e) => e.name),
        href: `/train/${tomorrowPhase.id}?day=${tomorrowKey}`,
      }
    : tomorrowWeekDay.swim
      ? { title: "Swim", time: tomorrowWeekDay.swim, exercises: [], href: "/analytics?tab=swim" }
      : null;

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
    excusedFromISO: settingsRow.trainingStatus === "healthy" ? null : settingsRow.trainingStatusSince,
  });

  // Training load: daily tonnage this week vs last week (dashed), same ACWR
  // takeaway Analytics uses. null (not 0) for days with no lift logged --
  // ComparisonLine breaks the line there instead of drawing a fake dip to zero.
  // Chart session load (sRPE-based) -- the same series ACWR and the takeaway
  // already use -- not main-lift tonnage. Tonnage required a weighted main
  // lift, so bodyweight/unrated sessions read as "no sessions logged"; it
  // still lives on Analytics' Load card.
  const dailyLoadByDate = new Map(dailyLoads.map((d) => [d.date, d.load]));
  const thisWeekDaily = Array.from({ length: 7 }, (_, i) => dailyLoadByDate.get(addDaysISO(weekStart, i)) ?? null);
  const lastWeekDaily = Array.from({ length: 7 }, (_, i) => dailyLoadByDate.get(addDaysISO(weekStart, i - 7)) ?? null);
  const trainingLoadTakeaway = loadTakeaway(acwr);

  const recentPRs = findRecentPRs({ mainLiftLogs, swimTimes, cmjTests });

  const followUps = [
    todaySession ? `What should I focus on in ${todaySession.title}?` : "How's my training this week?",
    "How's my nutrition looking today?",
  ];

  // Same underlying facts the brief's system prompt is told to reference --
  // surfaced as bullets so the brief text is never the only place the data
  // behind it shows up.
  const coachBriefBullets = [
    consistency.pct !== null ? `${consistency.pct}% consistency · 4wk` : "New to the plan — no consistency data yet",
    todaySession ? `Today: ${todaySession.title}` : weekDay.swim ? "Today: Swim" : "Today: Rest day",
    `${daysToNcaa}d to NCAA`,
  ];

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center justify-between">
        <span className="text-title-3 font-semibold text-[var(--rtd-text)] md:hidden">Home</span>
        <div className="flex items-center gap-2 ml-auto">
          <QuickLogSheet
            lastNightSleep={recentSleepLogs[0] ? { hours: Number(recentSleepLogs[0].hours), bedtime: recentSleepLogs[0].bedtime } : null}
            lastWeighInKg={latestWeighIn ? Number(latestWeighIn.kg) : null}
            phaseId={todaySession ? currentPhase.id : null}
            todayExercises={todaySession?.exercises.map((e) => ({ id: e.id, name: e.name })) ?? []}
          />
          <div className="md:hidden">
            <MoreMenuButton trainingStatus={settingsRow.trainingStatus} />
          </div>
        </div>
      </div>

      <AlertCardList alerts={alerts} />

      {/* Every module renders exactly once. Mobile order (order-N) and
          desktop order (md:order-N) are two independent sequences declared
          explicitly on every child -- see the two lists below -- rather than
          left to fall back on default/tied ordering, since the fuel/stat
          cluster sits in the MIDDLE of the mobile sequence but near the TOP
          of the desktop one; a partial override would place it wrong on one
          side.
          LOOP_PHASE5_PROMPT.md P5: three doorway dials (Readiness/Fuel/
          Consistency) now sit directly under the hero band on both mobile
          and desktop. The prompt's own reordering for mobile explicitly
          named 5 components below the dials (Plan -> Brief -> Load ->
          WeekMap -> PRs, swapping Load/WeekMap from their old order) but
          didn't mention the fuel/stat cluster or Needs-attention -- rather
          than delete real dashboard data the athlete uses daily on an
          ambiguous omission, both stay in the flow, placed right after the
          explicitly-named sequence.
          Mobile:  Hero(1) Dials(2) Plan(3) Brief(4) FuelCluster(5) Needs(6) Load(7) WeekMap(8) PRs(9)
          Desktop: Hero(1) Dials(2) Calendar(3) FuelCluster(4) Plan(5) Brief(6) Needs(7) WeekMap(8) Load(9) PRs(10) */}
      <div className="rtd-home-grid">
        <HomeHeroBand
          daysToNcaa={daysToNcaa}
          daysToAsean={daysToAsean}
          aseanLabel={aseanLabel}
          aseanDateLabel={aseanDateLabel}
          aseanConfirmed={settingsRow.aseanConfirmed}
          seasonPct={seasonPct}
          phaseTag={currentPhase.tag}
          phaseName={currentPhase.name}
          weekNumber={weekNumber}
          readinessOverall={readinessOverall}
          readinessSignals={readinessSignals}
          actionLine={readinessActionLineText}
          className="order-1 md:order-1"
        />
        <HomeDoorwayDials
          readinessOverall={readinessOverall}
          greenSignalCount={readinessSignals.filter((s) => s.light === "green").length}
          totalSignalCount={readinessSignals.length}
          kcalToday={kcalToday}
          kcalTargetMid={kcalTarget.mid}
          consistencyPct={consistency.pct}
          className="order-2 md:order-2 col-span-full"
        />
        <MonthCalendarCard
          today={today}
          gymDates={recentWorkoutLogs.map((l) => l.date)}
          swimDates={recentSwimSessions.map((s) => s.date)}
          className="hidden md:flex md:order-3"
        />

        {/* FuelRingCard + the two stat tiles share one wrapper so they can
            be a compact 2-col cluster on mobile (Fuel spans both cols,
            stats split the row below) while dissolving via md:contents on
            desktop so each keeps its own independent col-span in the 12-col
            grid. display:contents makes the WRAPPER's own order inert at
            desktop, so md:order-4 has to live on each child individually. */}
        <div className="grid grid-cols-2 gap-2.5 order-5 md:contents">
          <FuelRingCard
            kcalToday={kcalToday}
            kcalTargetMid={kcalTarget.mid}
            proteinToday={proteinToday}
            proteinTargetG={proteinTarget.mid}
            carbsToday={carbsToday}
            carbsTargetG={carbsFatTarget.carbsG}
            fatToday={fatToday}
            fatTargetG={carbsFatTarget.fatG}
            waterMl={waterToday}
            waterTargetMl={settingsRow.waterTargetMl}
            className="col-span-2 md:col-span-6 md:row-span-2 md:order-4"
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
            className="md:col-span-3 md:row-span-2 md:order-4"
          />
          <StatCard
            label="Consistency"
            value={consistency.pct !== null ? `${consistency.pct}%` : "—"}
            domainColor="var(--rtd-blue)"
            icon={<IconTrain />}
            sub={consistency.pct !== null ? `${consistency.done}/${consistency.planned} · 4wk` : "no data yet"}
            className="md:col-span-3 md:row-span-2 md:order-4"
          />
        </div>

        <TodaysPlanCard
          rows={planRows}
          startHref={startHref}
          tomorrow={tomorrowPreview}
          phaseId={todaySession ? currentPhase.id : null}
          todayExercises={todaySession?.exercises.map((e) => ({ id: e.id, name: e.name })) ?? []}
          className="order-3 md:order-5"
        />
        <CoachBriefCard
          brief={dailyBrief}
          bullets={coachBriefBullets}
          followUps={followUps}
          className="order-4 md:order-6"
        />
        <NeedsAttentionList items={needsAttention} className="col-span-3 row-span-3 h-full order-6 md:order-7" />

        <TrainingLoadCard
          thisWeekDaily={thisWeekDaily}
          lastWeekDaily={lastWeekDaily}
          takeaway={trainingLoadTakeaway}
          className="order-7 md:order-9"
        />
        <WeekMapCard days={weekMap.days} rows={weekMap.rows} className="order-8 md:order-8" />
        <RecentPRsCard prs={recentPRs} className="order-9 md:order-10" />
      </div>

      <div className="grid grid-cols-3 gap-2 mt-1 md:hidden">
        {MORE_ROW_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center gap-1 py-3 cursor-pointer hover:bg-white/[0.04] active:scale-[0.98] rounded-[10px] transition-[background-color,transform] duration-150 ease-out"
          >
            <span className="text-lg" aria-hidden="true">{item.icon}</span>
            <span className="text-caption text-[var(--rtd-text-secondary)]">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
