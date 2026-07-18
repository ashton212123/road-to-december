import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";
import { SleepLogger } from "@/components/more/SleepLogger";
import { SorenessLogger } from "@/components/more/SorenessLogger";
import { CmjQuickLog } from "@/components/more/CmjQuickLog";
import { getSleepLogs, getSorenessLogs, getCmjTests, getWorkoutLogsWithExerciseSince } from "@/lib/db/queries";
import { computeReadinessSignals, type ReadinessLight } from "@/lib/rules/readiness";
import { computeDailySessionLoads, computeAcwr } from "@/lib/analytics/load";
import { addDaysISO, todayManilaISO } from "@/lib/time";
import { withRetry } from "@/lib/db/withRetry";

const LIGHT_COLOR: Record<ReadinessLight, string> = {
  green: "var(--rtd-green)",
  yellow: "var(--rtd-orange)",
  red: "var(--rtd-red)",
};

export default async function RecoveryPage() {
  const today = todayManilaISO();
  const [sleepLogs, sorenessLogs, cmjTests, mainLiftLogs] = await withRetry(() =>
    Promise.all([
      getSleepLogs(14),
      getSorenessLogs(10),
      getCmjTests(4),
      getWorkoutLogsWithExerciseSince(addDaysISO(today, -35)),
    ])
  );

  const lastSleep = sleepLogs[0] ? Number(sleepLogs[0].hours) : null;

  const cmjSorted = [...cmjTests].sort((a, b) => (a.date < b.date ? -1 : 1));
  const cmjTrend: "up" | "flat" | "down" | "insufficient-data" =
    cmjSorted.length < 2
      ? "insufficient-data"
      : Number(cmjSorted[cmjSorted.length - 1].bestOf3Cm) > Number(cmjSorted[cmjSorted.length - 2].bestOf3Cm)
        ? "up"
        : Number(cmjSorted[cmjSorted.length - 1].bestOf3Cm) < Number(cmjSorted[cmjSorted.length - 2].bestOf3Cm)
          ? "down"
          : "flat";

  const dailyLoads = computeDailySessionLoads(mainLiftLogs);
  const acwr = computeAcwr(dailyLoads);
  const latestRatio = acwr.length > 0 ? acwr[acwr.length - 1].ratio : null;

  const signals = computeReadinessSignals({ lastSleepHours: lastSleep, cmjTrend, acwrRatio: latestRatio });
  const overall: ReadinessLight = signals.some((s) => s.light === "red")
    ? "red"
    : signals.some((s) => s.light === "yellow")
      ? "yellow"
      : "green";

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1">
      <SectionLabel>Recovery</SectionLabel>

      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="w-4 h-4 rounded-full shrink-0" style={{ background: LIGHT_COLOR[overall] }} />
          <div className="text-sm font-semibold">Readiness — three transparent inputs, no invented score</div>
        </div>
        <div className="flex flex-col gap-2">
          {signals.map((s) => (
            <div key={s.label} className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: LIGHT_COLOR[s.light] }} />
              <div>
                <div className="text-xs font-medium">{s.label}</div>
                <div className="text-[10px] text-[var(--rtd-text-tertiary)]">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <CmjQuickLog />
      <SleepLogger />
      <SorenessLogger />

      {sorenessLogs.length > 0 && (
        <div>
          <SectionLabel>Recent soreness</SectionLabel>
          <GlassCard className="flex flex-col gap-1.5">
            {sorenessLogs.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="text-[var(--rtd-text-secondary)]">{s.area}</span>
                <span className="text-[var(--rtd-text-tertiary)]">
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
