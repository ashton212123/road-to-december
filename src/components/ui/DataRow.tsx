import { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";

/** Miles OS retoken: dense label/value row for terminal-style data lists --
 * label in prose (Inter), value in mono/tabular via .rtd-mono. Spec's "row
 * dividers, not row backgrounds, separate list items" rule -- a 1px
 * bottom hairline on every row, not just non-last ones, since a trailing
 * rule under the final row of a list is the accepted look in the reference
 * kit (e.g. CRM's kanban cards) and this component has no way to know
 * whether it's the last child of its parent list. */
export function DataRow({
  label,
  value,
  sub,
  href,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: string;
  href?: string;
  className?: string;
}) {
  const content = (
    <div
      className={clsx("flex items-center justify-between gap-3 py-1.5", className)}
      style={{ borderBottom: "1px solid var(--rtd-mos-border-row)" }}
    >
      <span className="truncate min-w-0" style={{ font: "400 11px/1.3 var(--font-sans)", color: "var(--rtd-mos-fg-2)" }}>
        {label}
      </span>
      <span className="flex items-baseline gap-1.5 shrink-0">
        <span className="rtd-mono font-semibold" style={{ fontSize: "11px", color: "var(--rtd-mos-fg)" }}>
          {value}
        </span>
        {sub && <span className="text-caption text-[var(--rtd-text-tertiary)]">{sub}</span>}
      </span>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="contents focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2">
        {content}
      </Link>
    );
  }
  return content;
}
