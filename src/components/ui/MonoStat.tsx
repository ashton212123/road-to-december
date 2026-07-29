import clsx from "clsx";

const SIZE_CLASS = {
  sm: "text-title-3",
  md: "text-title-2",
  lg: "text-[34px] md:text-[44px] leading-[1.05]",
} as const;

// Miles OS metric scale ("Metric small"/"Metric large" in the spec's type
// table): font-weight 300/200, not the legacy sizes' bold, and large gets
// its own tighter tracking. Separate keys from sm/md/lg (not a redefinition
// of them) so every existing non-Miles-OS caller is untouched.
const MOS_SIZE_STYLE = {
  small: { fontSize: "var(--rtd-mos-fs-metric-sm)", fontWeight: 300, letterSpacing: "0" },
  large: { fontSize: "29px", fontWeight: 200, letterSpacing: "-.02em" },
} as const;

type Size = keyof typeof SIZE_CLASS | keyof typeof MOS_SIZE_STYLE;

/** Phase 9 (§9a): every number/stat/time/score routes through this instead
 * of raw text -- monospace, tabular, tight tracking. Not animated itself;
 * pages that want a count-up keep using the existing AnimatedNumber and
 * apply .rtd-mono directly, since MonoStat's job is static display. */
export function MonoStat({
  value,
  label,
  color,
  size = "md",
  className,
}: {
  value: string | number;
  label?: string;
  color?: string;
  size?: Size;
  className?: string;
}) {
  const isMos = size === "small" || size === "large";
  const mosStyle = isMos ? MOS_SIZE_STYLE[size as "small" | "large"] : null;
  return (
    <div className={clsx("flex flex-col", className)}>
      <span
        className={clsx("rtd-mono", !isMos && "font-bold tracking-[-0.02em]", !isMos && SIZE_CLASS[size as keyof typeof SIZE_CLASS])}
        style={{ color: color ?? "var(--rtd-text)", ...mosStyle }}
      >
        {value}
      </span>
      {label && <span className="rtd-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--rtd-text-tertiary)] mt-1">{label}</span>}
    </div>
  );
}
