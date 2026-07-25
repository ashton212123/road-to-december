import Link from "next/link";

const CELL_COLOR = (pct: number) => {
  if (pct >= 90) return "var(--rtd-green)";
  if (pct >= 60) return "var(--rtd-orange)";
  return "var(--rtd-red)";
};

export function FuelAdherenceCard({ days }: { days: { date: string; kcal: number; kcalTargetMin: number }[] }) {
  const recent = [...days].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-42);
  const loggedDays = recent.filter((d) => d.kcal > 0);
  const avgPct =
    loggedDays.length > 0
      ? Math.round(loggedDays.reduce((s, d) => s + (d.kcal / d.kcalTargetMin) * 100, 0) / loggedDays.length)
      : null;

  return (
    <div id="detail-fuel" className="rtd-open-section flex flex-col gap-3">
      <div className="rtd-micro-label">Fuel adherence</div>
      <p className="text-subhead text-[var(--rtd-text)] leading-snug">
        {avgPct !== null ? (
          `Averaging ${avgPct}% of kcal target over the last ${loggedDays.length} logged day${loggedDays.length === 1 ? "" : "s"}.`
        ) : (
          <>
            Needs more data —{" "}
            <Link href="/fuel" className="underline decoration-dotted underline-offset-2 hover:text-[var(--rtd-text-secondary)]">
              log a few meals
            </Link>{" "}
            to see adherence.
          </>
        )}
      </p>
      {recent.length > 0 && (
        <div className="grid grid-cols-7 gap-1">
          {recent.map((d) => {
            const pct = d.kcal > 0 ? (d.kcal / d.kcalTargetMin) * 100 : 0;
            return (
              <div
                key={d.date}
                title={`${d.date}: ${d.kcal ? Math.round(pct) + "%" : "not logged"}`}
                className="aspect-square rounded-sm"
                style={{ background: d.kcal > 0 ? CELL_COLOR(pct) : "rgba(255,255,255,0.05)" }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
