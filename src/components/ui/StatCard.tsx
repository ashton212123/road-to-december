import { ReactNode } from "react";
import { GlassCard } from "./GlassCard";
import clsx from "clsx";

export function StatCard({
  label,
  value,
  sub,
  accent,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={clsx("flex flex-col gap-1 min-w-0", className)}>
      <div className="flex items-center justify-between">
        <span className="rtd-micro-label truncate">{label}</span>
        {icon}
      </div>
      <span
        className="rtd-display text-2xl leading-tight truncate"
        style={{ color: accent ?? "var(--rtd-text)" }}
      >
        {value}
      </span>
      {sub && <span className="text-xs text-[var(--rtd-text-tertiary)] truncate">{sub}</span>}
    </GlassCard>
  );
}
