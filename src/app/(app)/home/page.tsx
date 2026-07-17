import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { StatCard } from "@/components/ui/StatCard";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AlertCardList } from "@/components/rules/AlertCardList";
import { AssignmentRow } from "@/components/school/AssignmentRow";
import { seasonData } from "@/lib/data/season-data";
import { todayManilaISO, todayDayKey, daysBetween } from "@/lib/time";
import {
  getAllPhasesWithSessions,
  getCurrentPhase,
  getLatestWeighIn,
  getWeighIns,
  getFoodLogsForDate,
  getWaterLogsForDate,
  getSettingsRow,
  getUndoneBusinessTasks,
} from "@/lib/db/queries";
import { computeKcalTarget, computeProteinTargetG, sevenDayAverage } from "@/lib/fuel/targets";
import { evaluateAlerts } from "@/lib/rules/engine";
import { getCanvasSummary, getUrgentAssignments } from "@/lib/canvas/sync";

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

  const [allPhases, latestWeighIn, weighInHistory, todaysFood, todaysWater, settingsRow, alerts, undoneTasks, canvas] =
    await Promise.all([
      getAllPhasesWithSessions(),
      getLatestWeighIn(),
      getWeighIns(10),
      getFoodLogsForDate(today),
      getWaterLogsForDate(today),
      getSettingsRow(),
      evaluateAlerts(),
      getUndoneBusinessTasks(5),
      getCanvasSummary(),
    ]);

  const urgentAssignments = getUrgentAssignments(canvas.assignments).slice(0, 5);

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

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1">
      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="rtd-micro-label">Days to NCAA · Dec 4</div>
            <div className="rtd-display text-4xl mt-1">{daysToNcaa}</div>
          </div>
          <span
            className="text-xs font-semibold px-2.5 py-1 rounded-full"
            style={{ background: `${currentPhase.color}26`, color: currentPhase.color }}
          >
            {currentPhase.tag} · {currentPhase.name}
          </span>
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

      {(urgentAssignments.length > 0 || undoneTasks.length > 0) && (
        <div>
          <SectionLabel>Priorities</SectionLabel>
          <GlassCard className="flex flex-col divide-y divide-white/[0.06]">
            {urgentAssignments.map((a) => (
              <AssignmentRow key={`canvas-${a.id}`} assignment={a} />
            ))}
            {undoneTasks.map((t) => (
              <Link key={`task-${t.id}`} href={`/business/${t.businessId}`} className="py-1 flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <div className="text-[var(--rtd-text)] truncate">{t.title}</div>
                  <div className="text-[10px] text-[var(--rtd-text-tertiary)]">
                    {t.businessName}
                    {t.dueDate ? ` · due ${t.dueDate}` : ""}
                  </div>
                </div>
                <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[var(--rtd-text-tertiary)]">
                  Task
                </span>
              </Link>
            ))}
          </GlassCard>
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
