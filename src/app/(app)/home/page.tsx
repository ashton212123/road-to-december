import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatCard } from "@/components/ui/StatCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { AlertCardList } from "@/components/rules/AlertCardList";
import { NeedsAttentionList } from "@/components/home/NeedsAttentionList";
import { seasonData } from "@/lib/data/season-data";
import { todayManilaISO, todayDayKey, daysBetween, addDaysISO, manilaHourNow } from "@/lib/time";
import {
  getAllPhasesWithSessions,
  getCurrentPhase,
  getLatestWeighIn,
  getWeighIns,
  getFoodLogsForDate,
  getWaterLogsForDate,
  getSettingsRow,
  getUndoneBusinessTasks,
  getWorkoutLogsSince,
  getSwimSessions,
  getSleepLogs,
} from "@/lib/db/queries";
import { computeKcalTarget, computeProteinTargetG, sevenDayAverage } from "@/lib/fuel/targets";
import { evaluateAlerts } from "@/lib/rules/engine";
import { getCanvasSummary, getUrgentAssignments, getCriticalAssignments } from "@/lib/canvas/sync";
import { computeTrainingStreak } from "@/lib/analytics/streak";
import { buildAttentionItems } from "@/lib/dashboard/needsAttention";
import { withRetry } from "@/lib/db/withRetry";
import { getDailyBrief } from "@/lib/coach/dailyBrief";

const DAY_KEY_TO_WEEK_INDEX: Record<string, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

export default async function HomePage() {
  const today = todayManilaISO();
  const todayKey = todayDayKey();

  // Cache-only read (no live Canvas API call) so Home never blocks on
  // Canvas's response time -- the School page's live sync (with its own
  // "Sync now" button) is where a human is expected to wait a moment.
  // Fetched once and shared with evaluateAlerts() below so a stale-cache
  // window can't trigger two concurrent live syncs racing each other.
  //
  // The whole fetch is wrapped in withRetry because the DB connection has
  // shown intermittent, total hangs (Vercel<->Supabase connection flakiness).
  // Most failures are transient, so a bounded retry turns "hangs forever"
  // into "takes an extra second or two" instead.
  const {
    canvas,
    allPhases,
    latestWeighIn,
    weighInHistory,
    todaysFood,
    todaysWater,
    settingsRow,
    alerts,
    undoneTasks,
    recentWorkoutLogs,
    recentSwimSessions,
    recentSleepLogs,
  } = await withRetry(async () => {
    const canvas = await getCanvasSummary({ sync: false });

    // settingsRow/todaysFood/weighIns/workoutLogs are all needed both here and
    // inside evaluateAlerts (which wants a wider or overlapping range in every
    // case) -- fetched once each and the same in-flight promise passed to
    // both, instead of querying twice per page load on an already-strained DB
    // (see DECISIONS.md). weighIns is widened to 21 (Home only ever needed
    // the most recent 2 rows for its own trend display, which a 21-row query
    // still gives); workoutLogs uses Home's existing -150-day window, and
    // evaluateAlerts filters that down to just today's rows locally.
    const settingsRowPromise = getSettingsRow();
    const todaysFoodPromise = getFoodLogsForDate(today);
    const weighIns21Promise = getWeighIns(21);
    const workoutLogsWidePromise = getWorkoutLogsSince(addDaysISO(today, -150));

    const [
      allPhases,
      latestWeighIn,
      weighInHistory,
      todaysFood,
      todaysWater,
      settingsRow,
      alerts,
      undoneTasks,
      recentWorkoutLogs,
      recentSwimSessions,
      recentSleepLogs,
    ] = await Promise.all([
      getAllPhasesWithSessions(),
      getLatestWeighIn(),
      weighIns21Promise,
      todaysFoodPromise,
      getWaterLogsForDate(today),
      settingsRowPromise,
      Promise.all([settingsRowPromise, todaysFoodPromise, weighIns21Promise, workoutLogsWidePromise]).then(
        ([settingsRow, todaysFood, weighIns21, workoutLogsWide]) =>
          evaluateAlerts(canvas, { settingsRow, todaysFood, weighIns21, workoutLogsWide })
      ),
      getUndoneBusinessTasks(5),
      workoutLogsWidePromise,
      getSwimSessions(5),
      getSleepLogs(1),
    ]);

    return {
      canvas,
      allPhases,
      latestWeighIn,
      weighInHistory,
      todaysFood,
      todaysWater,
      settingsRow,
      alerts,
      undoneTasks,
      recentWorkoutLogs,
      recentSwimSessions,
      recentSleepLogs,
    };
  });

  // Anything within 48h is already a distinct, more severe "Coach" alert
  // (see rules/engine.ts) -- exclude it here so it doesn't show twice.
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
  const waterToday = todaysWater.reduce((sum, w) => sum + w.ml, 0);
  const waterTarget = settingsRow.waterTargetMl;

  const weightTrend =
    weighInHistory.length >= 2
      ? Number(weighInHistory[0].kg) - Number(weighInHistory[1].kg)
      : null;

  const hour = manilaHourNow();
  const needsAttention = buildAttentionItems({
    today,
    todayKey,
    hour,
    currentPhaseId: currentPhase.id,
    todaySession,
    weekDay,
    loggedWorkoutToday: recentWorkoutLogs.some((l) => l.date === today),
    loggedSwimSessionToday: recentSwimSessions.some((s) => s.date === today),
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
      loggedWorkoutToday: recentWorkoutLogs.some((l) => l.date === today),
      loggedSwimToday: recentSwimSessions.some((s) => s.date === today),
      activeAlertHeadlines: alerts.map((a) => a.title),
    })
  );

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1 md:grid md:grid-cols-12 md:gap-6 md:items-start">
      <GlassCard className="flex flex-col gap-3 md:col-span-7 md:order-1">
        <div className="flex items-start justify-between">
          <div>
            <div className="rtd-micro-label">Days to NCAA · Dec 4</div>
            <div className="rtd-display text-large-title mt-1">
              <AnimatedNumber value={daysToNcaa} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span
              className="text-footnote font-semibold px-2.5 py-1 rounded-full"
              style={{ background: `${currentPhase.color}26`, color: currentPhase.color }}
            >
              {currentPhase.tag} · {currentPhase.name}
            </span>
            {trainingStreak > 0 && (
              <span className="text-footnote font-semibold px-2.5 py-1 rounded-full bg-[var(--rtd-orange)]/15 text-[var(--rtd-orange)]">
                🔥 {trainingStreak} day{trainingStreak === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        {settingsRow.aseanConfirmed !== false ? (
          <div className="flex items-baseline gap-1.5">
            <span className="rtd-display text-title-1">
              <AnimatedNumber value={daysToAsean} />
            </span>
            <span className="text-subhead text-[var(--rtd-text-secondary)]">
              days to ASEAN · {aseanDateLabel}
              {settingsRow.aseanConfirmed === null && " (unconfirmed)"}
            </span>
          </div>
        ) : (
          <div className="text-subhead text-[var(--rtd-text-secondary)]">{aseanLabel}</div>
        )}
        <div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${seasonPct}%`, background: "var(--rtd-blue)" }}
            />
          </div>
          <div className="text-caption text-[var(--rtd-text-secondary)] mt-1">
            {seasonPct}% through the 21-week season
          </div>
        </div>
      </GlassCard>

      {dailyBrief && (
        <div className="md:col-span-12 md:order-3">
          <SectionLabel>Today&apos;s brief</SectionLabel>
          <GlassCard className="text-subhead text-[var(--rtd-text)] leading-snug">{dailyBrief}</GlassCard>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2 md:col-span-6 md:order-4">
          <SectionLabel>Coach</SectionLabel>
          <AlertCardList alerts={alerts} />
        </div>
      )}

      {needsAttention.length > 0 && (
        <div className="md:col-span-6 md:order-5">
          <SectionLabel>Needs attention</SectionLabel>
          <NeedsAttentionList items={needsAttention} />
        </div>
      )}

      <div className="md:col-span-12 md:order-6">
        <SectionLabel>Today · {weekDay.full}</SectionLabel>
        <GlassCard className="flex flex-col gap-3">
          <div>
            <div className="text-footnote text-[var(--rtd-text-secondary)]">Swim</div>
            <div className="text-subhead text-[var(--rtd-text)]">{weekDay.swim ?? "Rest"}</div>
          </div>
          {todaySession ? (
            <Link
              href={`/train/${currentPhase.id}?day=${todayKey}`}
              className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-3.5 py-3 cursor-pointer hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
            >
              <div>
                <div className="text-footnote text-[var(--rtd-text-secondary)]">Gym</div>
                <div className="text-body font-medium text-[var(--rtd-text)]">{todaySession.title}</div>
              </div>
              <span className="text-[var(--rtd-blue)] text-subhead font-medium">Open →</span>
            </Link>
          ) : (
            <div>
              <div className="text-footnote text-[var(--rtd-text-secondary)]">Gym</div>
              <div className="text-subhead text-[var(--rtd-text)]">{weekDay.gym ?? "Off — full rest"}</div>
            </div>
          )}
        </GlassCard>
      </div>

      <div className="md:col-span-5 md:order-2">
        <SectionLabel>Quick stats</SectionLabel>
        <div className="grid grid-cols-2 gap-3 md:gap-2">
          <StatCard
            label="Weight"
            value={latestWeighIn ? `${Number(latestWeighIn.kg).toFixed(1)} kg` : "—"}
            sub={
              weightTrend !== null
                ? `${weightTrend >= 0 ? "+" : ""}${weightTrend.toFixed(1)} kg vs last`
                : "No trend yet"
            }
            accent={weightTrend !== null && weightTrend > 0 ? "var(--rtd-green)" : undefined}
          />
          <StatCard
            label="Kcal today"
            value={`${kcalToday}`}
            sub={`of ${kcalTarget.min}–${kcalTarget.max}`}
            accent={kcalToday >= kcalTarget.min ? "var(--rtd-green)" : "var(--rtd-orange)"}
          />
          <StatCard
            label="Protein today"
            value={`${Math.round(proteinToday)}g`}
            sub={`of ${proteinTarget.min}–${proteinTarget.max}g`}
            accent={proteinToday >= proteinTarget.min ? "var(--rtd-green)" : "var(--rtd-orange)"}
          />
          <GlassCard className="flex items-center gap-3">
            <ProgressRing
              pct={(waterToday / waterTarget) * 100}
              size={52}
              strokeWidth={6}
              color="var(--rtd-cyan)"
              ariaLabel={`Water: ${(waterToday / 1000).toFixed(1)} of ${(waterTarget / 1000).toFixed(1)} liters`}
            />
            <div className="min-w-0">
              <div className="rtd-micro-label">Water</div>
              <div className="text-body font-semibold truncate">
                {(waterToday / 1000).toFixed(1)}L / {(waterTarget / 1000).toFixed(1)}L
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
