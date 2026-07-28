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
import { HabitsCard } from "@/components/home/HabitsCard";
import { GoalsCard } from "@/components/home/GoalsCard";
import { CalendarStripCard } from "@/components/home/CalendarStripCard";
import { OperatorCard } from "@/components/home/OperatorCard";
import { KeyTasksCard } from "@/components/home/KeyTasksCard";
import { StatCard } from "@/components/ui/StatCard";
import { seasonData } from "@/lib/data/season-data";
import { todayManilaISO, todayDayKey, dayKeyForDate, daysBetween, addDaysISO, manilaHourNow, mondayOf } from "@/lib/time";
import {
  getAllPhasesWithSessionsUncached,
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
  getSorenessLogs,
  getSessionLoadsSince,
  getAllMeetsWithEvents,
} from "@/lib/db/queries";
import { computeProteinTargetG, sevenDayAverage } from "@/lib/fuel/targets";
import { computeEnergyTarget, computeAutoEnergyPhase } from "@/lib/fuel/energyModel";
import { buildDayFuelPlan } from "@/lib/fuel/carbPeriodization";
import { deriveDaySchedule } from "@/lib/fuel/scheduleFromWeek";
import { computePhaseWeek } from "@/lib/train/phaseWeek";
import { TYPE_LABELS, type SessionType } from "@/lib/swim/sessionType";
import { evaluateAlerts } from "@/lib/rules/engine";
import { getCanvasSummary, getUrgentAssignments, getCriticalAssignments } from "@/lib/canvas/sync";
import { computeConsistencyPct } from "@/lib/analytics/streak";
import { applyTrainingStatusCap, readinessActionLine } from "@/lib/rules/readinessTone";
import { buildAttentionItems } from "@/lib/dashboard/needsAttention";
import { buildWeekMap } from "@/lib/dashboard/weekMap";
import { findRecentPRs } from "@/lib/dashboard/recentPRs";
import { withRetry } from "@/lib/db/withRetry";
import { withFallback } from "@/lib/db/withFallback";
import { getHomeHabitsData } from "@/lib/habits/queries";
import { buildHabitStreakDots } from "@/lib/habits/streak";
import { getHomeGoalsData } from "@/lib/goals/queries";
import { getHomeKeyTasks } from "@/lib/crm/queries";
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

// Fallback for getSettingsRow -- matches the row getSettingsRow itself
// creates on first run (schema.ts's `settings` defaults), so a starved
// settings query degrades to the same values a fresh install would see.
const FALLBACK_SETTINGS = {
  id: "singleton",
  aseanConfirmed: null,
  waterTargetMl: 3000,
  weightUnit: "kg" as const,
  trainingStatus: "healthy" as const,
  trainingStatusSince: null,
  energyPhase: null,
  kcalTargetOverride: null,
  poolCourseDefault: "SCM" as const,
};

// Every DB read Home needs, cached and tagged "home-data" -- every log-
// writing server action revalidates this tag. evaluateAlerts is
// deliberately NOT called in here: it reads the wall-clock hour internally
// (some alerts only fire after a threshold hour), so it has to run fresh on
// every request against these cached raw rows, not get frozen at whatever
// hour first populated the cache.
// Key versioned (v3, loop 39) because this function's returned shape lost
// mainLiftLogs (findRecentPRs no longer needs it -- swim PRs + CMJ only) --
// same reasoning as analytics/page.tsx's cache key: the tag alone doesn't
// invalidate a same-day entry warmed before this deploy.
const getCachedHomeData = unstable_cache(
  async (today: string) => {
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
      weekFoodLogs,
      sorenessLogs,
      sessionLoads,
      allMeets,
      habitsData,
      goalsData,
      keyTasks,
    ] = await Promise.all([
      withFallback(getAllPhasesWithSessionsUncached(), []),
      withFallback(getLatestWeighIn(), null),
      withFallback(getWeighIns(21), []),
      withFallback(getFoodLogsForDate(today), []),
      withFallback(getWaterLogsForDate(today), []),
      withFallback(getSettingsRow(), FALLBACK_SETTINGS),
      withFallback(getUndoneBusinessTasks(5), []),
      withFallback(getWorkoutLogsSince(addDaysISO(today, -150)), []),
      withFallback(getSwimSessions(60), []),
      withFallback(getSleepLogs(30), []),
      withFallback(getCmjTests(30), []),
      withFallback(getSwimTimes(200), []),
      withFallback(getFoodLogsSince(addDaysISO(today, -13)), []), // 14-day window: also feeds computeEnergyTarget's weight-response average
      withFallback(getSorenessLogs(1), []),
      withFallback(getSessionLoadsSince(addDaysISO(today, -150)), []),
      withFallback(getAllMeetsWithEvents(), []),
      withFallback(getHomeHabitsData(today, addDaysISO(today, -29)), { habits: [], dailyCompletion: [] }),
      withFallback(getHomeGoalsData(), { week: [], month: [] }),
      withFallback(getHomeKeyTasks(), []),
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
      weekFoodLogs,
      sorenessLogs,
      sessionLoads,
      allMeets,
      habitsData,
      goalsData,
      keyTasks,
    };
  },
  ["home-page-data-v6"],
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
    weekFoodLogs,
    sorenessLogs,
    sessionLoads,
    allMeets,
    habitsData,
    goalsData,
    keyTasks,
  } = await withRetry(() => getCachedHomeData(today), { timeoutMs: 15000 });

  const habitStreakDots = buildHabitStreakDots(habitsData.dailyCompletion, habitsData.habits.length, today);

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

  // `allPhases` is the static 6-phase season program -- it should never be
  // empty in real operation. If it transiently is (a caching/DB hiccup), the
  // page must degrade honestly (empty session list, no fabricated phase name)
  // rather than crash the whole Home page on a missing-property TypeError.
  const currentPhase =
    getCurrentPhase(allPhases, today) ??
    allPhases[0] ??
    (() => {
      console.error(`[home] allPhases was empty for ${today} -- falling back to a placeholder phase`);
      return {
        id: "unknown",
        tag: "—",
        name: "Program data unavailable",
        weeks: "",
        dates: "",
        color: "#8a8a8e",
        blurb: "",
        note: null,
        startDate: today,
        endDate: today,
        isDeload: false,
        deloadWeek: null,
        isRaceBlock: false,
        waveScheme: null,
        blocks: null,
        orderIndex: 0,
        sessions: [],
      };
    })();
  const phaseWeek = computePhaseWeek(currentPhase, today);
  const seasonStart = seasonData.meta.seasonStart;
  const seasonEnd = seasonData.meta.seasonEnd;
  const seasonPct = Math.min(
    100,
    Math.max(0, Math.round((daysBetween(seasonStart, today) / daysBetween(seasonStart, seasonEnd)) * 100))
  );
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

  const nextMeetDateForEnergy = allMeets.filter((m) => m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0]?.date ?? null;
  const energyPhase =
    settingsRow.energyPhase ??
    computeAutoEnergyPhase({ todayISO: today, bulkWindowEndISO: seasonData.meta.bulkWindowEnd, firstMeetDateISO: nextMeetDateForEnergy });
  const kcalByDate = new Map<string, number>();
  for (const f of weekFoodLogs) kcalByDate.set(f.date, (kcalByDate.get(f.date) ?? 0) + f.kcal);
  const energyTarget = computeEnergyTarget({
    todayISO: today,
    energyPhase,
    kcalTargetOverride: settingsRow.kcalTargetOverride,
    weighIns: weighInHistory.map((w) => ({ date: w.date, kg: Number(w.kg) })),
    recentKcal: [...kcalByDate.entries()].map(([date, kcal]) => ({ date, kcal })),
  });
  const proteinAvgWeight = sevenDayAverage(weighInHistory) ?? Number(latestWeighIn?.kg ?? 63);
  const proteinTarget = computeProteinTargetG(proteinAvgWeight);
  const kcalToday = todaysFood.reduce((sum, f) => sum + f.kcal, 0);
  const proteinToday = todaysFood.reduce((sum, f) => sum + Number(f.proteinG), 0);
  const carbsToday = todaysFood.reduce((sum, f) => sum + Number(f.carbsG ?? 0), 0);
  const fatToday = todaysFood.reduce((sum, f) => sum + Number(f.fatG ?? 0), 0);
  const todaySchedule = deriveDaySchedule(weekDay);
  const dayFuelPlan = buildDayFuelPlan({
    dateISO: today,
    bodyweightKg: proteinAvgWeight,
    energyTarget,
    ...todaySchedule,
  });
  const carbsFatTarget = { carbsG: dayFuelPlan.carbsG, fatG: dayFuelPlan.fatG };
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

  // Loop 39.3: real recent training rhythm (oldest -> newest) for the daily
  // brief to reference factually -- never fabricated, just the last few
  // logged session types with a recorded classification.
  const recentSessionTypes = [...recentSwimSessions]
    .filter((s) => s.sessionType !== null)
    .slice(0, 5)
    .reverse()
    .map((s) => TYPE_LABELS[s.sessionType as SessionType] ?? s.sessionType!);

  const dailyBrief = await withRetry(() =>
    getDailyBrief({
      today,
      athleteWeightKg: latestWeighIn ? Number(latestWeighIn.kg) : null,
      weightTrendKg: weightTrend,
      kcalToday,
      kcalTargetMin: energyTarget.low,
      kcalTargetMax: energyTarget.high,
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
      recentSessionTypes,
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
      sessionType: todaySchedule.plannedSessionType ? TYPE_LABELS[todaySchedule.plannedSessionType] : null,
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

  const recentPRs = findRecentPRs({ swimTimes, cmjTests });

  // Phase 7's Home strip: 7 days starting today, overlaying this app's own
  // known dates (meets, planned swim/gym) onto whatever the external
  // calendar feed returns client-side -- no new DB queries, reuses
  // allMeets/allPhases/seasonData already fetched above for the week map.
  const calendarStripDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysISO(today, i);
    const dayKey = dayKeyForDate(date);
    const dayMeets = allMeets.filter((m) => m.date === date).map((m) => m.name);
    const wd = seasonData.WEEK[DAY_KEY_TO_WEEK_INDEX[dayKey]];
    const phaseForDate = getCurrentPhase(allPhases, date) ?? currentPhase;
    const sessionForDate = phaseForDate.sessions.find((s) => s.dayKey === dayKey) ?? null;
    return { date, meets: dayMeets, swimPlanned: Boolean(wd.swim), gymTitle: sessionForDate?.title ?? null };
  });

  const followUps = [
    todaySession ? `What should I focus on in ${todaySession.title}?` : "How's my training this week?",
    "How's my nutrition looking today?",
  ];

  // Same underlying facts the brief's system prompt is told to reference --
  // surfaced as bullets so the brief text is never the only place the data
  // behind it shows up.
  const todaysFocus = todaySession ? todaySession.title : weekDay.swim ? "Swim" : "Rest day";

  const coachBriefBullets = [
    consistency.pct !== null ? `${consistency.pct}% consistency · 4wk` : "New to the plan — no consistency data yet",
    todaySession ? `Today: ${todaySession.title}` : weekDay.swim ? "Today: Swim" : "Today: Rest day",
    `${daysToNcaa}d to NCAA`,
  ];

  return (
    <div className="flex flex-col gap-2.5 md:gap-3 pt-1">
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

      {/* Phase 8 (§8b): Home is the 9 numbered operator sections, in this
          exact order on mobile (single column) and flowing 3-per-row on
          desktop (each section colSpan={4} of the 12-col grid, Operator
          alone spanning all 12) -- no per-section order-N classes needed
          since JSX order already matches both breakpoints' required order.
          The pre-Phase-8 dashboard modules that aren't part of the 9
          (readiness header, doorway dials, AI daily brief, week map, recent
          PRs, month calendar) are kept, not deleted -- placed around the 9
          rather than folded into them, per an explicit product decision
          logged in PERSONAL_OS_LOG.md rather than silently cut to match the
          spec table literally. */}
      <div className="rtd-home-grid">
        <OperatorCard
          role={seasonData.meta.athlete}
          daysToDecember={daysToNcaa}
          todaysFocus={todaysFocus}
          consistencyPct={consistency.pct}
          consistencyDone={consistency.done}
          consistencyPlanned={consistency.planned}
          className="col-span-full"
        />
        <HomeHeroBand
          daysToNcaa={daysToNcaa}
          daysToAsean={daysToAsean}
          aseanLabel={aseanLabel}
          aseanDateLabel={aseanDateLabel}
          aseanConfirmed={settingsRow.aseanConfirmed}
          seasonPct={seasonPct}
          phaseTag={currentPhase.tag}
          phaseName={currentPhase.name}
          phaseWeek={phaseWeek}
          readinessOverall={readinessOverall}
          readinessSignals={readinessSignals}
          actionLine={readinessActionLineText}
          className="col-span-full"
        />
        <HomeDoorwayDials
          readinessOverall={readinessOverall}
          greenSignalCount={readinessSignals.filter((s) => s.light === "green").length}
          totalSignalCount={readinessSignals.length}
          kcalToday={kcalToday}
          kcalTargetMid={energyTarget.kcal}
          consistencyPct={consistency.pct}
          className="col-span-full"
        />

        <TodaysPlanCard
          rows={planRows}
          startHref={startHref}
          tomorrow={tomorrowPreview}
          phaseId={todaySession ? currentPhase.id : null}
          todayExercises={todaySession?.exercises.map((e) => ({ id: e.id, name: e.name })) ?? []}
        />
        <HabitsCard habits={habitsData.habits} dots={habitStreakDots} today={today} />
        <CalendarStripCard days={calendarStripDays} today={today} />
        <GoalsCard data={goalsData} />
        <KeyTasksCard tasks={keyTasks} />
        <TrainingLoadCard thisWeekDaily={thisWeekDaily} lastWeekDaily={lastWeekDaily} takeaway={trainingLoadTakeaway} />
        <FuelRingCard
          kcalToday={kcalToday}
          kcalTargetMid={energyTarget.kcal}
          proteinToday={proteinToday}
          proteinTargetG={proteinTarget.mid}
          carbsToday={carbsToday}
          carbsTargetG={carbsFatTarget.carbsG}
          fatToday={fatToday}
          fatTargetG={carbsFatTarget.fatG}
          waterMl={waterToday}
          waterTargetMl={settingsRow.waterTargetMl}
        />
        <NeedsAttentionList items={needsAttention} className="col-span-4 row-span-2 h-full" />

        {/* Retained extras (not part of the 9 spec sections): AI daily
            brief, month calendar, week map, recent PRs, and the two stat
            tiles displaced from the old fuel cluster. Collapsed on mobile
            behind a disclosure, same as before Phase 8. */}
        <CoachBriefCard brief={dailyBrief} bullets={coachBriefBullets} followUps={followUps} className="col-span-full md:col-span-8" />
        <MonthCalendarCard
          today={today}
          gymDates={recentWorkoutLogs.map((l) => l.date)}
          swimDates={recentSwimSessions.map((s) => s.date)}
          className="hidden md:flex md:col-span-4"
        />

        <details className="col-span-full md:contents">
          <summary className="rtd-glass md:hidden cursor-pointer select-none list-none rounded-[10px] px-3.5 py-2.5 flex items-center justify-between text-subhead font-medium text-[var(--rtd-text-secondary)]">
            More today
            <span aria-hidden="true" className="rtd-more-today-chevron">⌄</span>
          </summary>
          <div className="flex flex-col gap-2.5 mt-2.5 md:contents">
            <WeekMapCard days={weekMap.days} rows={weekMap.rows} className="md:col-span-6" />
            <RecentPRsCard prs={recentPRs} className="md:col-span-3" />
            <StatCard
              label="Bodyweight (7d)"
              numericValue={latestWeighIn ? Number(latestWeighIn.kg) : 0}
              decimals={1}
              suffix=" kg"
              domainColor="var(--rtd-cyan)"
              deltaPct={weightTrendPct}
              goodDirection="up"
              sparklinePoints={weightSeries.slice(-14).map((w) => Number(w.kg))}
              className="md:col-span-3"
            />
          </div>
        </details>
      </div>
    </div>
  );
}
