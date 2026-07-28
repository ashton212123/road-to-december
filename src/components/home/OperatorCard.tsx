import { TerminalPanel } from "@/components/ui/TerminalPanel";

/** `01 // OPERATOR` -- identity + the day's single most important facts.
 * "Days to December" is daysToNcaa (NCAA Philippines lands on the season's
 * own December end date), "streak" reuses the existing rolling-consistency
 * number from src/lib/analytics/streak.ts -- both already computed once by
 * Home, passed in rather than recomputed here. */
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
    <TerminalPanel label="01 // OPERATOR" colSpan={12} className={className}>
      <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-8">
        <div className="flex flex-col">
          <span className="text-title-2 font-extrabold tracking-tight text-[var(--rtd-text)]">Ashton</span>
          <span className="text-caption text-[var(--rtd-text-tertiary)]">{role}</span>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-2">
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
