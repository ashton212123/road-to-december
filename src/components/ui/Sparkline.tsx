/** Tiny trend line with a fading gradient fill, no axes. Draws in on mount via CSS (rtd-sparkline-path), gated by prefers-reduced-motion in globals.css. */
export function Sparkline({
  points,
  color,
  width = 120,
  height = 40,
  endDot = false,
}: {
  points: number[];
  color: string;
  width?: number;
  height?: number;
  /** Glowing dot on the last point (Fitonist endpoint treatment) -- opt-in,
   * enabled only where a sparkline reads as a live "current value" trend
   * (StatCard, the improvement matrix's row sparklines). */
  endDot?: boolean;
}) {
  // Quiet spacer, not a message: callers (StatCard, ImprovementMatrix) carry
  // their own empty-state copy, and "Not enough data yet" next to a live
  // value reads as a contradiction (seen on the water matrix cell).
  if (points.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p - min) / range) * (height - 4) - 2;
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const fillPath = `${linePath} L${width},${height} L0,${height} Z`;
  const gradientId = `rtd-spark-grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  const approxLength = coords.reduce((sum, [x, y], i) => {
    if (i === 0) return sum;
    const [px, py] = coords[i - 1];
    return sum + Math.hypot(x - px, y - py);
  }, 0);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="rtd-sparkline-path"
        style={{ ["--rtd-dash" as string]: approxLength || 1 }}
      />
      {endDot && (
        <circle
          cx={coords[coords.length - 1][0]}
          cy={coords[coords.length - 1][1]}
          r="2.5"
          fill={color}
          style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
      )}
    </svg>
  );
}
