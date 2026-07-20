"use client";

/** Shared glass tooltip for every retrofitted Recharts chart -- replaces the
 * default white Recharts tooltip everywhere. Built once, passed as
 * `<Tooltip content={<GlassTooltip valueFormatter={...} />} />`; Recharts
 * clones the element and injects active/payload/label at render time. */
export function GlassTooltip({
  active,
  payload,
  label,
  valueFormatter,
  color,
}: {
  active?: boolean;
  payload?: { value: number; name?: string; color?: string }[];
  label?: string;
  valueFormatter?: (v: number) => string;
  color?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        border: "0.5px solid rgba(255,255,255,0.1)",
        borderRadius: 8,
        padding: "6px 10px",
        fontSize: 12,
      }}
    >
      {label && <div style={{ color: "rgba(235,235,245,0.45)", marginBottom: payload.length > 0 ? 2 : 0 }}>{label}</div>}
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color ?? color ?? "#F5F5F7" }}>
          {p.name ? `${p.name}: ` : ""}
          {valueFormatter ? valueFormatter(p.value) : p.value}
        </div>
      ))}
    </div>
  );
}

/** Pattern-color pill legend for the tonnage/hard-sets stacked bar charts --
 * replaces Recharts' default `<Legend/>` swatch row. */
export function PatternLegend({ patterns }: { patterns: { label: string; color: string }[] }) {
  return (
    <div className="flex items-center justify-end flex-wrap gap-1.5">
      {patterns.map((p) => (
        <span
          key={p.label}
          className="inline-flex items-center gap-1.5 text-caption text-[var(--rtd-text-secondary)] bg-white/[0.06] rounded-full px-2 py-1"
        >
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          {p.label}
        </span>
      ))}
    </div>
  );
}
