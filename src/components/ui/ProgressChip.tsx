/** For intraday % accumulators (kcal/protein/water) -- these never get a
 * period-over-period delta (comparing a partial current period against a
 * complete previous one produces nonsense like "-100%" the moment today's
 * count resets to zero). Instead, color by progress toward target:
 * gray under 70%, green 70-110%, orange over 110% -- except metrics where
 * "over" is still good (water), which never flags orange. */
export function ProgressChip({ pct, overIsGood = false }: { pct: number | null; overIsGood?: boolean }) {
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[var(--rtd-text-tertiary)] rtd-nums" style={{ fontSize: "12px" }}>
        —
      </span>
    );
  }

  const tone: "gray" | "green" | "orange" =
    pct < 70 ? "gray" : pct > 110 && !overIsGood ? "orange" : "green";
  const color = tone === "gray" ? "var(--rtd-text-tertiary)" : tone === "green" ? "var(--rtd-green)" : "var(--rtd-orange)";
  const bg = tone === "gray" ? "rgba(255,255,255,0.06)" : tone === "green" ? "rgba(48,209,88,0.15)" : "rgba(255,159,10,0.15)";

  return (
    <span
      className="inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-full rtd-nums"
      style={{ color, backgroundColor: bg, fontSize: "12px" }}
    >
      {Math.round(pct)}%
    </span>
  );
}
