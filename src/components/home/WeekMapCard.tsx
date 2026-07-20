import { Fragment } from "react";
import { BentoCard } from "@/components/ui/BentoCard";
import type { WeekMapRow } from "@/lib/dashboard/weekMap";

const CELL_COLOR: Record<string, string> = {
  logged: "var(--rtd-green)",
  missed: "var(--rtd-red)",
  future: "rgba(255,255,255,0.10)",
  rest: "rgba(255,255,255,0.05)",
  excused: "rgba(255,255,255,0.05)",
};

export function WeekMapCard({
  days,
  rows,
  className,
}: {
  days: { iso: string; short: string }[];
  rows: WeekMapRow[];
  className?: string;
}) {
  return (
    <BentoCard label="Week map" colSpan={4} rowSpan={2} className={className}>
      <div className="grid gap-y-1.5" style={{ gridTemplateColumns: "44px repeat(7, 1fr) 32px" }}>
        <div />
        {days.map((d) => (
          <div key={d.iso} className="text-caption text-center text-[var(--rtd-text-tertiary)]">
            {d.short[0]}
          </div>
        ))}
        <div />
        {rows.map((row) => (
          <Fragment key={row.label}>
            <div className="text-caption text-[var(--rtd-text-tertiary)] flex items-center">{row.label}</div>
            {row.cells.map((cell, i) => (
              <div key={i} className="flex items-center justify-center">
                <span className="w-2 h-2 rounded-full" style={{ background: CELL_COLOR[cell] }} />
              </div>
            ))}
            <div className="text-caption text-[var(--rtd-text-tertiary)] text-right rtd-nums flex items-center justify-end">
              {row.adherencePct !== null ? `${row.adherencePct}%` : "—"}
            </div>
          </Fragment>
        ))}
      </div>
    </BentoCard>
  );
}
