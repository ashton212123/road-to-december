import { Sparkline } from "@/components/ui/Sparkline";
import { ComparisonLine, ComparisonLegend } from "@/components/ui/ComparisonLine";
import { currentVsPreviousDaily, periodDayLabels } from "@/lib/analytics/periodCompare";
import type { Period } from "@/lib/analytics/periods";

export function RecoveryOverlayCard({
  sleepLogs,
  cmjSeries,
  sorenessLogs,
  today,
  period,
  offset,
}: {
  sleepLogs: { date: string; hours: number }[];
  cmjSeries: { date: string; cm: number }[];
  sorenessLogs: { id: number; date: string; area: string; rating1to5: number }[];
  today: string;
  period: Period;
  offset: number;
}) {
  const sleepSorted = [...sleepLogs].sort((a, b) => (a.date < b.date ? -1 : 1));
  const avgSleep = sleepSorted.length > 0 ? sleepSorted.reduce((s, x) => s + x.hours, 0) / sleepSorted.length : null;
  const recentSoreness = sorenessLogs.slice(0, 5);
  const periodWord = period === "week" ? "week" : "month";

  const sleepRows = sleepSorted.map((s) => ({ date: s.date, value: s.hours }));
  const sleepCmp = currentVsPreviousDaily(sleepRows, period, today, offset);
  const sleepLabels = periodDayLabels(period, sleepCmp.current.length);

  return (
    <div id="detail-recovery" className="rtd-glass p-5 flex flex-col gap-3">
      <div className="rtd-micro-label">Recovery</div>
      <p className="text-subhead text-[var(--rtd-text)] leading-snug">
        {avgSleep !== null
          ? `Averaging ${avgSleep.toFixed(1)}h sleep over ${sleepSorted.length} logged night${sleepSorted.length === 1 ? "" : "s"}.`
          : "Needs more data — log sleep to see trends."}
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-caption text-[var(--rtd-text-tertiary)]">Sleep (h), this {periodWord} vs last</div>
          <ComparisonLegend
            currentLabel={`This ${periodWord}`}
            previousLabel={`Last ${periodWord}`}
            color="var(--rtd-purple)"
            previousAvailable={sleepCmp.hasPrevious}
          />
        </div>
        <ComparisonLine current={sleepCmp.current} previous={sleepCmp.previous} color="var(--rtd-purple)" height={80} labels={sleepLabels} />
      </div>

      <div>
        <div className="text-caption text-[var(--rtd-text-tertiary)] mb-1">CMJ (cm)</div>
        <Sparkline points={cmjSeries.slice(-14).map((c) => c.cm)} color="var(--rtd-green)" width={140} height={40} />
      </div>

      {recentSoreness.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          <div className="text-caption text-[var(--rtd-text-tertiary)]">Recent soreness</div>
          {recentSoreness.map((s) => (
            <div key={s.id} className="flex items-center justify-between text-footnote">
              <span className="text-[var(--rtd-text-secondary)]">{s.area}</span>
              <span className="text-[var(--rtd-text-secondary)] rtd-nums">
                {s.date} · {s.rating1to5}/5
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
