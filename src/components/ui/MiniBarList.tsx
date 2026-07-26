export function MiniBarList({
  rows,
  color,
  colorFor,
  formatValue,
}: {
  rows: { label: string; value: number }[];
  /** Flat color for every row. Ignored when colorFor is given. */
  color?: string;
  /** Per-row color (e.g. tinting each row to match a zone/category color used
   * elsewhere on the same card). Takes precedence over color. */
  colorFor?: (row: { label: string; value: number }) => string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2.5">
          <span className="w-20 shrink-0 text-footnote text-[var(--rtd-text-secondary)] truncate">{r.label}</span>
          <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, backgroundColor: colorFor ? colorFor(r) : color }}
            />
          </div>
          <span className="w-12 shrink-0 text-footnote text-right text-[var(--rtd-text)] rtd-nums">
            {formatValue ? formatValue(r.value) : r.value}
          </span>
        </div>
      ))}
    </div>
  );
}
