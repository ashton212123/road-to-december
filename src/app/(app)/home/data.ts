import { cache } from "react";
import { unstable_cache } from "next/cache";
import { seasonData } from "@/lib/data/season-data";
import { todayDayKey, dayKeyForDate, daysBetween, addDaysISO, manilaHourNow, mondayOf } from "@/lib/time";
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
import { computeReadinessSignals } from "@/lib/rules/readiness";
import { computeDailySessionLoads, computeAcwr, computeWeeklyLoad, computeWeekOverWeekRamp } from "@/lib/analytics/load";
import { loadTakeaway, loadVerdict } from "@/lib/analytics/takeaways";

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
// invalidate a same-day entry warmed before this deploy. Bumped to v7 (WS6
// §2 Task 1) for the same reason: a starved-habits fallback entry warmed
// under the old query order would otherwise keep serving stale empty
// habits for up to 300s after the reorder fix deployed.
// revalidate: 300 (Personal OS merge, streaming pass) bounds staleness for a
// read that lands with no matching write in between -- tag invalidation
// still gives immediate freshness right after any log action.
const getCachedHomeData = unstable_cache(
  async (today: string) => {
    // The only query in this whole pipeline that wasn't wrapped in
    // withFallback -- getCanvasSummary's own db.select().from(canvasCourses)
    // (lib/canvas/sync.ts) has no timeout/fallback of its own, and it's
    // awaited here BEFORE the 19-query Promise.all even starts. Confirmed
    // live (WS6 §2 Task 1) as the actual root cause of the "persistent"
    // habits/phases 0-row fallbacks: canvas_courses hit Postgres's own 20s
    // statement_timeout on essentially every real request, which alone ate
    // the whole outer withRetry 15s budget before the Promise.all's own 19
    // queries got a fair chance to even start, let alone finish -- not a
    // queue-position problem inside the Promise.all at all.
    // Shorter than the 10s default: this runs before the 19-query Promise.all
    // even starts, so every second it eats here is a second stolen from the
    // outer withRetry's 15s budget for everything that actually renders the
    // page. Canvas only feeds the urgent/critical-assignments alert list, not
    // any core Home card, so a tight budget is the right trade here.
    const canvas = await withFallback(
      getCanvasSummary({ sync: false }),
      { configured: false, courses: [], assignments: [], syncedAt: null, error: null },
      5000
    );

    const [
      allPhases,
      habitsData,
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
      goalsData,
      keyTasks,
    ] = await Promise.all([
      withFallback(getAllPhasesWithSessionsUncached(), []),
      // Submitted 2nd (was 17th of 19): at its old position this query's own
      // withFallback race had almost always already elapsed by the time it
      // reached the front of the 3-connection queue, so it lost to its own
      // fallback on essentially every real request -- not intermittent
      // contention, a deterministic queue-position starvation (WS6 §2 Task 1).
      withFallback(getHomeHabitsData(today, addDaysISO(today, -29)), { habits: [], dailyCompletion: [] }),
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
  ["home-page-data-v7"],
  { tags: ["home-data"], revalidate: 300 }
);

// Home streams via several independent Suspense boundaries (header actions,
// main grid, coach brief) that all need this same view model. Wrapping in
// React's cache() memoizes it per-request: whichever boundary awaits it
// first triggers the underlying 19-query fetch + derivation below, every
// other boundary in the same render gets the same resolved promise instead
// of re-running it. Without this, splitting the page into boundaries would
// multiply the exact query load the tiny 3-connection pool can't absorb.
export const getHomeViewModel = cache(async (today: string) => {
  const todayKey = todayDayKey();
  const weekStart = mondayOf(today);
  const hour = manilaHourNow();

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
  } = await withRetry(() => getCachedHomeData(today), { timeoutMs: 15000, label: "Home dashboard data" });

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
  // WS5 §0 Task 4G: same storage/derivation pattern as NCAA/ASEAN above.
  // Surfaced in the hero band's three-meet ladder (WS6 §1) as the primary
  // long-term target.
  const daysToSeaGames2027 = Math.max(0, daysBetween(today, seasonData.meta.targets.seaGames2027Date));
  const daysToPaiTryout = Math.max(0, daysBetween(today, seasonData.meta.targets.paiTryoutDate));
  const aseanDateLabel = new Date(seasonData.meta.targets.aseanDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const ncaaDateLabel = new Date(seasonData.meta.targets.ncaaDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const seaGamesDateLabel = new Date(seasonData.meta.targets.seaGames2027Date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  const dailyLoadByDate = new Map(dailyLoads.map((d) => [d.date, d.load]));
  const thisWeekDaily = Array.from({ length: 7 }, (_, i) => dailyLoadByDate.get(addDaysISO(weekStart, i)) ?? null);
  const lastWeekDaily = Array.from({ length: 7 }, (_, i) => dailyLoadByDate.get(addDaysISO(weekStart, i - 7)) ?? null);
  const trainingLoadTakeaway = loadTakeaway(acwr);
  const trainingLoadVerdict = loadVerdict(acwr);

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

  return {
    today,
    todayKey,
    weekStart,
    hour,
    settingsRow,
    latestWeighIn,
    recentSleepLogs,
    alerts,
    daysToNcaa,
    daysToAsean,
    daysToSeaGames2027,
    daysToPaiTryout,
    aseanLabel,
    aseanDateLabel,
    ncaaDateLabel,
    seaGamesDateLabel,
    seasonPct,
    currentPhase,
    phaseWeek,
    readinessOverall,
    readinessSignals,
    readinessActionLineText,
    kcalToday,
    energyTarget,
    consistency,
    todaysFocus,
    thisWeekDaily,
    lastWeekDaily,
    trainingLoadTakeaway,
    trainingLoadVerdict,
    needsAttention,
    planRows,
    startHref,
    tomorrowPreview,
    todaySession,
    habitsData,
    habitStreakDots,
    calendarStripDays,
    proteinToday,
    proteinTarget,
    carbsToday,
    carbsFatTarget,
    fatToday,
    waterToday,
    goalsData,
    keyTasks,
    recentWorkoutLogs,
    recentSwimSessions,
    weekMap,
    recentPRs,
    weightSeries,
    weightTrendPct,
    // Daily-brief inputs only (CoachBriefSection's own boundary) -- kept here
    // so that boundary doesn't need to re-derive any of this itself, just
    // read it off the shared, cached view model.
    weightTrend,
    weekDay,
    loggedWorkoutToday,
    loggedSwimToday,
    recentSessionTypes,
    coachBriefBullets,
    followUps,
  };
});

export type HomeViewModel = Awaited<ReturnType<typeof getHomeViewModel>>;
