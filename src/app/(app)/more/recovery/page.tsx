import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";
import { SleepLogger } from "@/components/more/SleepLogger";
import { SorenessLogger } from "@/components/more/SorenessLogger";
import { CmjQuickLog } from "@/components/more/CmjQuickLog";
import { getSleepLogs, getSorenessLogs, getCmjTests, getWorkoutLogsWithExerciseSince, getSwimSessions, getSessionLoadsSince } from "@/lib/db/queries";
import { computeReadinessSignals, type ReadinessLight } from "@/lib/rules/readiness";
import { computeDailySessionLoads, computeWeeklyLoad, computeWeekOverWeekRamp } from "@/lib/analytics/load";
import { addDaysISO, todayManilaISO, mondayOf } from "@/lib/time";
import { withRetry } from "@/lib/db/withRetry";

const LIGHT_COLOR: Record<ReadinessLight, string> = {
  green: "var(--rtd-green)",
  yellow: "var(--rtd-orange)",
  red: "var(--rtd-red)",
};

export default async function RecoveryPage() {
  const today = todayManilaISO();
  const weekStart = mondayOf(today);
  const [sleepLogs, sorenessLogs, cmjTests, mainLiftLogs, swimSessions, sessionLoads] = await withRetry(() =>
    Promise.all([
      getSleepLogs(14),
      getSorenessLogs(10),
      getCmjTests(30),
      getWorkoutLogsWithExerciseSince(addDaysISO(today, -35)),
      getSwimSessions(60),
      getSessionLoadsSince(addDaysISO(today, -35)),
    ])
  );

  const lastSleep = sleepLogs[0] ? Number(sleepLogs[0].hours) : null;

  const cmjSorted = [...cmjTests].sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  const cmjLatestCm = cmjSorted.length > 0 ? Number(cmjSorted[0].bestOf3Cm) : null;
  const cmjBaselineWindow = cmjSorted.slice(1).filter((t) => t.date >= addDaysISO(today, -28));
  const cmjBaselineCm =
    cmjBaselineWindow.length > 0 ? cmjBaselineWindow.reduce((s, t) => s + Number(t.bestOf3Cm), 0) / cmjBaselineWindow.length : null;

  const dailyLoads = computeDailySessionLoads({
    sessionLoads: sessionLoads.map((s) => ({ date: s.date, kind: s.kind, load: s.load })),
    workoutLogs: mainLiftLogs,
  });
  const weeklyLoad = computeWeeklyLoad(dailyLoads);
  const loadRamp = computeWeekOverWeekRamp(weeklyLoad);
  const latestRampPct = loadRamp.length > 0 ? loadRamp[loadRamp.length - 1].pctChange : null;

  const breastKickByWeek = new Map<string, number>();
  for (const s of swimSessions) {
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
  const signals = computeReadinessSignals({
    lastSleepHours: lastSleep,
    cmjLatestCm,
    cmjBaselineCm,
    weeklyLoadRampPct: latestRampPct,
    breastKickRatio,
    recentSoreness,
  });
  const overall: ReadinessLight = signals.some((s) => s.light === "red")
    ? "red"
    : signals.some((s) => s.light === "yellow")
      ? "yellow"
      : "green";

  return (
    <div className="flex flex-col gap-4 pt-1 md:max-w-2xl md:mx-auto">
      <SectionLabel>Recovery</SectionLabel>

      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 rounded-full shrink-0" style={{ background: LIGHT_COLOR[overall] }} />
          <div className="text-body font-semibold">Readiness — transparent inputs, no invented score</div>
        </div>
        <div className="flex flex-col gap-2">
          {signals.map((s) => (
            <div key={s.label} className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: LIGHT_COLOR[s.light] }} />
              <div>
                <div className="text-footnote font-medium">{s.label}</div>
                <div className="text-footnote text-[var(--rtd-text-tertiary)]">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <CmjQuickLog />
      <SleepLogger lastNight={sleepLogs[0] ? { hours: Number(sleepLogs[0].hours), bedtime: sleepLogs[0].bedtime } : null} />
      <SorenessLogger />

      {sorenessLogs.length > 0 && (
        <div>
          <SectionLabel>Recent soreness</SectionLabel>
          <GlassCard className="flex flex-col gap-1.5">
            {sorenessLogs.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-footnote">
                <span className="text-[var(--rtd-text-secondary)]">{s.area}</span>
                <span className="text-[var(--rtd-text-secondary)]">
                  {s.date} · {s.rating1to5}/5
                </span>
              </div>
            ))}
          </GlassCard>
        </div>
      )}
    </div>
  );
}
