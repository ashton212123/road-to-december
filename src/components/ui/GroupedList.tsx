import { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";

/** iOS-style grouped list: one glass card, 52px rows separated by the
 * radial-fade divider, IconTile + label + trailing chevron/value. */
export function GroupedList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("rtd-glass flex flex-col rtd-divide-y overflow-hidden", className)}>{children}</div>;
}

export function GroupedListRow({
  href,
  icon,
  label,
  desc,
  trailing,
  onClick,
}: {
  href?: string;
  icon?: ReactNode;
  label: string;
  desc?: string;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const content = (
    <>
      {icon && <span className="shrink-0 flex items-center justify-center">{icon}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-subhead text-[var(--rtd-text)] truncate">{label}</span>
        {desc && <span className="block text-caption text-[var(--rtd-text-tertiary)] truncate">{desc}</span>}
      </span>
      {trailing}
    </>
  );
  const className =
    "flex items-center gap-3 min-h-[52px] px-4 hover:bg-white/[0.04] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 cursor-pointer";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={clsx(className, "text-left w-full")}>
      {content}
    </button>
  );
}
