import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatCard } from "@/components/ui/StatCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProgressRing } from "@/components/ui/ProgressRing";
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

    // settingsRow/todaysFood are needed both here and inside evaluateAlerts;
    // fetched once and the same in-flight promise passed to both instead of
    // querying twice -- one more redundant round-trip cut per page load on
    // an already-strained DB (see DECISIONS.md).
    const settingsRowPromise = getSettingsRow();
    const todaysFoodPromise = getFoodLogsForDate(today);

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
      getWeighIns(10),
      todaysFoodPromise,
      getWaterLogsForDate(today),
      settingsRowPromise,
      Promise.all([settingsRowPromise, todaysFoodPromise]).then(([settingsRow, todaysFood]) =>
        evaluateAlerts(canvas, { settingsRow, todaysFood })
      ),
      getUndoneBusinessTasks(5),
      getWorkoutLogsSince(addDaysISO(today, -150)),
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

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1">
      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="rtd-micro-label">Days to NCAA · Dec 4</div>
            <div className="rtd-display text-4xl mt-1">{daysToNcaa}</div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: `${currentPhase.color}26`, color: currentPhase.color }}
            >
              {currentPhase.tag} · {currentPhase.name}
            </span>
            {trainingStreak > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--rtd-orange)]/15 text-[var(--rtd-orange)]">
                🔥 {trainingStreak} day{trainingStreak === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
        {settingsRow.aseanConfirmed !== false ? (
          <div className="flex items-baseline gap-1.5">
            <span className="rtd-display text-lg">{daysToAsean}</span>
            <span className="text-xs text-[var(--rtd-text-secondary)]">
              days to ASEAN · {aseanDateLabel}
              {settingsRow.aseanConfirmed === null && " (unconfirmed)"}
            </span>
          </div>
        ) : (
          <div className="text-xs text-[var(--rtd-text-secondary)]">{aseanLabel}</div>
        )}
        <div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${seasonPct}%`, background: "var(--rtd-blue)" }}
            />
          </div>
          <div className="text-[10px] text-[var(--rtd-text-tertiary)] mt-1">
            {seasonPct}% through the 21-week season
          </div>
        </div>
      </GlassCard>

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Coach</SectionLabel>
          <AlertCardList alerts={alerts} />
        </div>
      )}

      {needsAttention.length > 0 && (
        <div>
          <SectionLabel>Needs attention</SectionLabel>
          <NeedsAttentionList items={needsAttention} />
        </div>
      )}

      <div>
        <SectionLabel>Today · {weekDay.full}</SectionLabel>
        <GlassCard className="flex flex-col gap-3">
          <div>
            <div className="text-xs text-[var(--rtd-text-tertiary)]">Swim</div>
            <div className="text-sm text-[var(--rtd-text)]">{weekDay.swim ?? "Rest"}</div>
          </div>
          {todaySession ? (
            <Link
              href={`/train/${currentPhase.id}?day=${todayKey}`}
              className="flex items-center justify-between rounded-2xl bg-white/[0.05] px-3.5 py-3"
            >
              <div>
                <div className="text-xs text-[var(--rtd-text-tertiary)]">Gym</div>
                <div className="text-sm font-medium text-[var(--rtd-text)]">{todaySession.title}</div>
              </div>
              <span className="text-[var(--rtd-blue)] text-sm font-medium">Open →</span>
            </Link>
          ) : (
            <div>
              <div className="text-xs text-[var(--rtd-text-tertiary)]">Gym</div>
              <div className="text-sm text-[var(--rtd-text)]">{weekDay.gym ?? "Off — full rest"}</div>
            </div>
          )}
        </GlassCard>
      </div>

      <div>
        <SectionLabel>Quick stats</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
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
            />
            <div className="min-w-0">
              <div className="rtd-micro-label">Water</div>
              <div className="text-sm font-semibold truncate">
                {(waterToday / 1000).toFixed(1)}L / {(waterTarget / 1000).toFixed(1)}L
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
