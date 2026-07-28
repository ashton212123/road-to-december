import { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";

/** Phase 9 (§9a): dense label/value row for terminal-style data lists --
 * label in prose (Inter), value in mono/tabular via .rtd-mono. */
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
    <div className={clsx("flex items-center justify-between gap-3 py-1.5", className)}>
      <span className="text-subhead text-[var(--rtd-text-secondary)] truncate min-w-0">{label}</span>
      <span className="flex items-baseline gap-1.5 shrink-0">
        <span className="rtd-mono text-subhead font-semibold text-[var(--rtd-text)]">{value}</span>
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
