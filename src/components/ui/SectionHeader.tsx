import { ReactNode } from "react";
import clsx from "clsx";

/** Phase 9 (§9a) section header primitive: `NN // TITLE` in uppercase mono
 * with letter-spacing, a hairline rule filling the remaining width, and an
 * optional status chip pinned right (e.g. a StatusChip). Used both as a
 * page-level heading and as the header row inside a TerminalPanel. */
export function SectionHeader({ title, statusChip, className }: { title: string; statusChip?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex items-center gap-2.5 min-w-0 shrink-0", className)}>
      <span className="rtd-mono text-[11px] md:text-xs font-semibold uppercase tracking-[0.08em] text-[var(--rtd-text-tertiary)] whitespace-nowrap">
        {title}
      </span>
      <span aria-hidden="true" className="flex-1 h-px min-w-3" style={{ background: "var(--rtd-hairline)" }} />
      {statusChip}
    </div>
  );
}
