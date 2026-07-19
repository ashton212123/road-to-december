import { Sparkline } from "@/components/ui/Sparkline";

export function RecoveryOverlayCard({
  sleepLogs,
  cmjSeries,
  sorenessLogs,
}: {
  sleepLogs: { date: string; hours: number }[];
  cmjSeries: { date: string; cm: number }[];
  sorenessLogs: { id: number; date: string; area: string; rating1to5: number }[];
}) {
  const sleepSorted = [...sleepLogs].sort((a, b) => (a.date < b.date ? -1 : 1));
  const avgSleep = sleepSorted.length > 0 ? sleepSorted.reduce((s, x) => s + x.hours, 0) / sleepSorted.length : null;
  const recentSoreness = sorenessLogs.slice(0, 5);

  return (
    <div id="detail-recovery" className="rtd-glass p-5 flex flex-col gap-3">
      <div className="rtd-micro-label">Recovery</div>
      <p className="text-subhead text-[var(--rtd-text)] leading-snug">
        {avgSleep !== null
          ? `Averaging ${avgSleep.toFixed(1)}h sleep over ${sleepSorted.length} logged night${sleepSorted.length === 1 ? "" : "s"}.`
          : "Needs more data — log sleep to see trends."}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-caption text-[var(--rtd-text-tertiary)] mb-1">Sleep (h)</div>
          <Sparkline points={sleepSorted.slice(-14).map((s) => s.hours)} color="var(--rtd-purple)" width={140} height={40} />
        </div>
        <div>
          <div className="text-caption text-[var(--rtd-text-tertiary)] mb-1">CMJ (cm)</div>
          <Sparkline points={cmjSeries.slice(-14).map((c) => c.cm)} color="var(--rtd-green)" width={140} height={40} />
        </div>
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
