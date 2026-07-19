import { ReactNode } from "react";
import clsx from "clsx";
import { BentoCard } from "./BentoCard";
import { IconTile } from "./IconTile";
import { AnimatedNumber } from "./AnimatedNumber";
import { DeltaChip } from "./DeltaChip";
import { Sparkline } from "./Sparkline";

/** Bento-grid stat tile: icon tile top-left, big count-up number, label,
 * optional delta chip, optional sparkline pinned to the bottom. Sparkline
 * and delta are both optional so simpler callers can render just the number. */
export function StatCard({
  label,
  value,
  numericValue,
  decimals = 0,
  suffix = "",
  sub,
  accent,
  domainColor,
  icon,
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
  icon?: ReactNode;
  deltaPct?: number | null;
  goodDirection?: "up" | "down";
  sparklinePoints?: number[];
  className?: string;
}) {
  const color = accent ?? domainColor ?? "var(--rtd-text)";

  return (
    <BentoCard className={clsx("gap-1", className)}>
      <div className="flex items-center justify-between">
        {icon && domainColor ? <IconTile color={domainColor}>{icon}</IconTile> : <span className="rtd-micro-label truncate">{label}</span>}
        {deltaPct !== undefined && <DeltaChip pct={deltaPct} goodDirection={goodDirection} />}
      </div>
      {icon && domainColor && <span className="rtd-micro-label truncate mt-1">{label}</span>}
      <span className="rtd-display rtd-nums text-title-1 leading-tight truncate" style={{ color }}>
        {numericValue !== undefined ? <AnimatedNumber value={numericValue} decimals={decimals} suffix={suffix} /> : value}
      </span>
      {sub && <span className="text-footnote text-[var(--rtd-text-tertiary)] truncate">{sub}</span>}
      {sparklinePoints && sparklinePoints.length > 0 && (
        <div className="flex-1 min-h-0 flex items-end mt-1">
          <Sparkline points={sparklinePoints} color={domainColor ?? "var(--rtd-blue)"} width={140} height={40} />
        </div>
      )}
    </BentoCard>
  );
}
