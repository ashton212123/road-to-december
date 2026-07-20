/** Direction is metric-aware: pass `goodDirection` for metrics where "up" isn't
 * always "good" (e.g. weight during a bulk, where holding or gaining is the goal). */
export function DeltaChip({
  pct,
  goodDirection = "up",
}: {
  pct: number | null;
  goodDirection?: "up" | "down";
}) {
  if (pct === null || Math.abs(pct) < 0.1) {
    return (
      <span className="inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[var(--rtd-text-tertiary)] rtd-nums" style={{ fontSize: "12px" }}>
        —
      </span>
    );
  }

  const isUp = pct > 0;
  const isGood = goodDirection === "up" ? isUp : !isUp;
  // Fitonist chips are solid with dark text -- they read as stamped verdicts,
  // not tints. Green = on track, red = off track.
  const bg = isGood ? "#4ade80" : "#f87171";
  const capped = Math.max(-99, Math.min(99, pct));

  return (
    <span
      className="inline-flex items-center gap-0.5 font-semibold px-1.5 py-0.5 rounded-full rtd-nums"
      style={{ color: "#0b0b0d", backgroundColor: bg, fontSize: "12px" }}
    >
      {isUp ? "↗" : "↘"} {isUp ? "+" : ""}
      {capped.toFixed(1)}%
    </span>
  );
}
