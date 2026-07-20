/** Current period vs previous period, same shape everywhere it's used
 * (Analytics detail cards, Home Training Load): current = solid domain-color
 * line with a soft glow and gradient fill; previous = dashed, no fill, 45%
 * alpha. Points are aligned by index (e.g. Mon..Sun), not by date, since the
 * two series cover different weeks/months of the same calendar shape. */
export function ComparisonLine({
  current,
  previous,
  color,
  width = 400,
  height = 120,
  labels,
}: {
  current: (number | null)[];
  previous: (number | null)[];
  color: string;
  width?: number;
  height?: number;
  labels?: string[];
}) {
  const allValues = [...current, ...previous].filter((v): v is number => v !== null);
  if (allValues.length < 2) {
    return <div className="flex items-center justify-center text-caption text-[var(--rtd-text-tertiary)]" style={{ height }}>Needs more data</div>;
  }

  const min = Math.min(...allValues, 0);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const n = Math.max(current.length, previous.length);
  const stepX = n > 1 ? width / (n - 1) : width;
  const pad = 4;

  function toPath(series: (number | null)[]): string {
    let d = "";
    let started = false;
    series.forEach((v, i) => {
      if (v === null) {
        started = false;
        return;
      }
      const x = i * stepX;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      d += started ? ` L${x.toFixed(1)},${y.toFixed(1)}` : `${d ? " " : ""}M${x.toFixed(1)},${y.toFixed(1)}`;
      started = true;
    });
    return d.trim();
  }

  const currentPath = toPath(current);
  const previousPath = toPath(previous);
  const fillPath = currentPath ? `${currentPath} L${(n - 1) * stepX},${height} L0,${height} Z` : "";
  const gradientId = `rtd-cmp-grad-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  // Fitonist two-tone: previous period rides in butter yellow against the
  // current series' domain color -- two glowing curves, not a line and its
  // ghost. Dotted horizontal gridlines complete the chart identity.
  const previousColor = "var(--rtd-butter)";
  const gridYs = [0.25, 0.5, 0.75].map((f) => pad + (height - pad * 2) * f);

  return (
    <div className="flex flex-col gap-1">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridYs.map((y) => (
          <line key={y} x1="0" x2={width} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="1 5" strokeLinecap="round" />
        ))}
        {fillPath && <path d={fillPath} fill={`url(#${gradientId})`} stroke="none" />}
        {previousPath && (
          <path d={previousPath} fill="none" stroke={previousColor} strokeOpacity="0.75" strokeWidth="1.5" strokeDasharray="5 4" strokeLinecap="round" />
        )}
        {currentPath && (
          <path
            d={currentPath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 40%, transparent))` }}
          />
        )}
      </svg>
      {labels && (
        <div className="flex justify-between text-caption text-[var(--rtd-text-tertiary)]">
          {labels.map((l, i) => (
            <span key={i}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Legend pills for a ComparisonLine -- "This week" solid dot, "Last week"
 * ring dot, each in its own white/6% rounded-full pill. When the previous
 * series has no data at all, the second pill goes muted with "No previous
 * data" instead of a ring dot -- never a fake mirrored line pretending
 * there's a comparison. */
export function ComparisonLegend({
  currentLabel,
  previousLabel,
  color,
  previousAvailable = true,
}: {
  currentLabel: string;
  previousLabel: string;
  color: string;
  previousAvailable?: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-caption text-[var(--rtd-text-secondary)] bg-white/[0.06] rounded-full px-2 py-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        {currentLabel}
      </span>
      <span className="inline-flex items-center gap-1.5 text-caption bg-white/[0.06] rounded-full px-2 py-1 text-[var(--rtd-text-tertiary)]">
        {previousAvailable ? (
          <>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: "var(--rtd-butter)", opacity: 0.85 }} />
            {previousLabel}
          </>
        ) : (
          "No previous data"
        )}
      </span>
    </div>
  );
}
