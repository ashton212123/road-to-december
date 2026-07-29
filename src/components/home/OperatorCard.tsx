import { TerminalPanel } from "@/components/ui/TerminalPanel";

/** `01 // OPERATOR` -- identity + the day's single most important facts.
 * "Days to December" is daysToNcaa (NCAA Philippines lands on the season's
 * own December end date), "streak" reuses the existing rolling-consistency
 * number from src/lib/analytics/streak.ts -- both already computed once by
 * Home, passed in rather than recomputed here.
 *
 * Miles OS moves this from a full-width hero bar into the grid's narrow
 * 262px left column (Home rebuild) -- always stacked vertically now (no
 * more md:flex-row), since that layout only made sense at full width. */
export function OperatorCard({
  role,
  daysToDecember,
  todaysFocus,
  consistencyPct,
  consistencyDone,
  consistencyPlanned,
  className,
}: {
  role: string;
  daysToDecember: number;
  todaysFocus: string;
  consistencyPct: number | null;
  consistencyDone: number;
  consistencyPlanned: number;
  className?: string;
}) {
  return (
    <TerminalPanel label="OPERATOR" number="01" className={className}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col">
          <span className="text-title-2 font-extrabold tracking-tight text-[var(--rtd-text)]">Ashton</span>
          <span className="text-caption text-[var(--rtd-text-tertiary)]">{role}</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col">
            <span className="text-title-3 font-bold rtd-nums rtd-mono text-[var(--rtd-text)]">{daysToDecember}d</span>
            <span className="text-caption text-[var(--rtd-text-tertiary)]">to December</span>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-subhead font-semibold text-[var(--rtd-text)] truncate">{todaysFocus}</span>
            <span className="text-caption text-[var(--rtd-text-tertiary)]">Today&apos;s focus</span>
          </div>
          <div className="flex flex-col">
            <span className="text-title-3 font-bold rtd-nums rtd-mono text-[var(--rtd-text)]">
              {consistencyPct !== null ? `${consistencyPct}%` : "—"}
            </span>
            <span className="text-caption text-[var(--rtd-text-tertiary)]">
              Streak · {consistencyDone}/{consistencyPlanned} · 4wk
            </span>
          </div>
        </div>
      </div>
    </TerminalPanel>
  );
}
