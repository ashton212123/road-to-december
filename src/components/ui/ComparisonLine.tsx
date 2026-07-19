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

  return (
    <div className="flex flex-col gap-1">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {fillPath && <path d={fillPath} fill={`url(#${gradientId})`} stroke="none" />}
        {previousPath && (
          <path d={previousPath} fill="none" stroke={color} strokeOpacity="0.45" strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" />
        )}
        {currentPath && (
          <path
            d={currentPath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
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

/** Legend pills for a ComparisonLine -- "This week" solid dot, "Last week" ring dot. */
export function ComparisonLegend({ currentLabel, previousLabel, color }: { currentLabel: string; previousLabel: string; color: string }) {
  return (
    <div className="flex items-center gap-3 text-caption text-[var(--rtd-text-tertiary)]">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        {currentLabel}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ border: `1.5px solid ${color}`, opacity: 0.6 }} />
        {previousLabel}
      </span>
    </div>
  );
}
