import { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { IconChevronRight } from "./icons";

/** The shared shell for every card in the bento grid: glass base, 20px
 * padding, fills its grid area, optional header row (micro-label + icon tile
 * + trailing link chevron). Every page card becomes one of these. */
export function BentoCard({
  children,
  className,
  style,
  label,
  icon,
  href,
  colSpan,
  rowSpan,
  /** "open" keeps the grid LAYOUT (colSpan/rowSpan) but drops the glass
   * background/border/shadow -- for desktop bento cells whose mobile
   * counterpart is an .rtd-open-section, not a genuinely interactive
   * surface. Default "card" is the original glass chrome, unchanged. */
  variant = "card",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  label?: string;
  icon?: ReactNode;
  href?: string;
  colSpan?: number;
  rowSpan?: number;
  variant?: "card" | "open";
}) {
  const spanStyle: CSSProperties = {
    ...(colSpan ? { gridColumn: `span ${colSpan} / span ${colSpan}` } : {}),
    ...(rowSpan ? { gridRow: `span ${rowSpan} / span ${rowSpan}` } : {}),
    ...style,
  };

  const content = (
    <div
      className={clsx(
        variant === "card" && "rtd-glass",
        "rtd-bento-card h-full flex flex-col gap-2 p-3.5 md:p-5 min-w-0",
        href && "cursor-pointer",
        className
      )}
      style={spanStyle}
    >
      {(label || icon || href) && (
        <div className="flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            {label && <span className="rtd-micro-label truncate">{label}</span>}
          </div>
          {href && <IconChevronRight className="text-[var(--rtd-text-tertiary)] shrink-0" />}
        </div>
      )}
      <div className="flex-1 min-h-0 flex flex-col">{children}</div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="contents focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 rounded-[10px]">
        {content}
      </Link>
    );
  }
  return content;
}
