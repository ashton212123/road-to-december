import clsx from "clsx";

const SIZE_CLASS = {
  sm: "text-title-3",
  md: "text-title-2",
  lg: "text-[34px] md:text-[44px] leading-[1.05]",
} as const;

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
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-col", className)}>
      <span className={clsx("rtd-mono font-bold tracking-[-0.02em]", SIZE_CLASS[size])} style={{ color: color ?? "var(--rtd-text)" }}>
        {value}
      </span>
      {label && <span className="rtd-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--rtd-text-tertiary)] mt-1">{label}</span>}
    </div>
  );
}
