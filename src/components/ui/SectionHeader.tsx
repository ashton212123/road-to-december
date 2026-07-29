import { ReactNode } from "react";
import clsx from "clsx";

/** Miles OS section header primitive: `NN // TITLE` in uppercase mono with
 * letter-spacing, a hairline rule filling the remaining width, and an
 * optional status chip pinned right (e.g. a StatusChip). Used both as a
 * page-level heading and as the header row inside a TerminalPanel.
 *
 * `number` is optional -- the numbered `NN //` prefix (its `//` dimmer than
 * the label, per spec) is a Miles-OS-panel convention, not something every
 * one of this component's existing plain-title callers across the app needs
 * to adopt. Type scale (8.5px/500/.16em/--fg-dim) is the spec's exact
 * Section-label recipe and applies to every caller either way. */
export function SectionHeader({
  title,
  number,
  statusChip,
  className,
}: {
  title: string;
  number?: string;
  statusChip?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center gap-2.5 min-w-0 shrink-0", className)}>
      <span
        className="uppercase whitespace-nowrap"
        style={{ font: "500 var(--rtd-mos-fs-section)/1 var(--rtd-font-mono)", letterSpacing: "var(--rtd-mos-ls-section)", color: "var(--rtd-mos-fg-dim)" }}
      >
        {number && (
          <>
            {number} <span style={{ color: "var(--rtd-mos-rule)" }}>{"//"}</span>{" "}
          </>
        )}
        {title}
      </span>
      <span aria-hidden="true" className="flex-1 h-px min-w-3" style={{ background: "var(--rtd-hairline)" }} />
      {statusChip}
    </div>
  );
}
