import { ReactNode } from "react";
import clsx from "clsx";
import { BentoCard } from "./BentoCard";
import { AnimatedNumber } from "./AnimatedNumber";
import { DeltaChip } from "./DeltaChip";
import { Sparkline } from "./Sparkline";

/** Bento-grid stat tile: whole-card domain tint carries identity (no
 * IconTile here -- those stay in list rows/matrix rows/card headers), 11px
 * label top-left, big number with its delta chip inline on the same
 * baseline, sparkline pinned to the bottom. Sparkline and delta are both
 * optional so simpler callers can render just the number. */
export function StatCard({
  label,
  value,
  numericValue,
  decimals = 0,
  suffix = "",
  sub,
  accent,
  domainColor,
  deltaPct,
  goodDirection,
  sparklinePoints,
  className,
}: {
  label: string;
  value?: ReactNode;
  numericValue?: number;
  decimals?: number;
  suffix?: string;
  sub?: ReactNode;
  accent?: string;
  domainColor?: string;
  /** @deprecated icon tiles were removed from StatCard -- the whole-card tint now carries domain identity. Kept for prop-compat, ignored. */
  icon?: ReactNode;
  deltaPct?: number | null;
  goodDirection?: "up" | "down";
  sparklinePoints?: number[];
  className?: string;
}) {
  const color = accent ?? domainColor ?? "var(--rtd-text)";

  return (
    <BentoCard className={clsx("gap-1 relative overflow-hidden", className)}>
      {domainColor && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: `color-mix(in srgb, ${domainColor} 7%, transparent)` }}
        />
      )}
      <span className="rtd-micro-label truncate relative">{label}</span>
      <div className="flex items-baseline gap-1.5 min-w-0 relative">
        {/* Mobile keeps V4's 28px density; desktop steps up to the shared
            big-num scale (44px) instead of the old ad-hoc 32px. */}
        <span className="rtd-display rtd-nums leading-tight truncate text-[28px] md:text-[44px]" style={{ color }}>
          {numericValue !== undefined ? <AnimatedNumber value={numericValue} decimals={decimals} suffix={suffix} /> : value}
        </span>
        {deltaPct !== undefined && <DeltaChip pct={deltaPct} goodDirection={goodDirection} />}
      </div>
      {sub && <span className="text-footnote text-[var(--rtd-text-tertiary)] truncate relative">{sub}</span>}
      {/* Reserve the sparkline zone whenever the caller passed the prop at
          all (even empty/short) -- never just leave a void when there isn't
          yet enough history. Only cards that never track a trend (Kcal,
          Week completion) skip this block entirely by omitting the prop. */}
      {sparklinePoints !== undefined && (
        <div className="flex-1 min-h-0 flex items-end mt-1 relative">
          {sparklinePoints.length >= 2 ? (
            <Sparkline points={sparklinePoints} color={domainColor ?? "var(--rtd-blue)"} width={140} height={40} endDot />
          ) : (
            <div className="w-full flex flex-col gap-1 pb-0.5">
              <div className="w-full border-t border-dashed" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
              <span className="text-caption text-[var(--rtd-text-tertiary)]">tracking starts after 2+ days of logs</span>
            </div>
          )}
        </div>
      )}
    </BentoCard>
  );
}
