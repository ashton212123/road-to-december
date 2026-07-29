import { CSSProperties, DragEvent, KeyboardEvent, MouseEvent, ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { SectionHeader } from "./SectionHeader";

const PADDING = { sm: "p-3", md: "p-3.5 md:p-5" } as const;
const GAP = { none: "gap-0", sm: "gap-1.5", md: "gap-2" } as const;

/** Phase 9 (§9a) replacement for BentoCard/GlassCard: same shell contract
 * (colSpan/rowSpan/href/variant), terminal panel material instead of iOS
 * glass. `label`/`statusChip` are a convenience that renders a SectionHeader
 * for the common case -- callers with a custom header row (e.g. one that
 * also needs an inline action button) can render their own SectionHeader as
 * the first child instead and omit `label`.
 *
 * `fill`/`padding`/`gap` exist for non-grid callers (a repeating list row
 * like CRM's TaskCard, not a bento grid cell) that need the same panel
 * material without the grid-cell-filling `h-full` or the roomier grid
 * padding. `interactive` adds the hover-affordance class used by "open"
 * rows that only want a background on hover/press (mirrors GlassCard's own
 * `interactive` prop) -- independent of `variant` since a hover-only row
 * (variant="open" + interactive) is a real, distinct look from either a
 * permanent box (variant="panel") or fully inert content (variant="open"
 * alone). The onClick/drag/keyboard props are plain passthrough so a caller
 * can make the whole panel a click/drag target without dropping to raw
 * markup. */
export function TerminalPanel({
  children,
  className,
  style,
  label,
  number,
  statusChip,
  href,
  colSpan,
  rowSpan,
  variant = "panel",
  fill = true,
  padding = "md",
  gap = "md",
  interactive = false,
  onClick,
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  role,
  tabIndex,
  onKeyDown,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  label?: string;
  /** Miles OS numbered-panel prefix (e.g. "01") -- rendered via
   * SectionHeader's own `number` prop so the `//` glyph gets its dimmer
   * spec color. Only meaningful when `label` is also set. */
  number?: string;
  statusChip?: ReactNode;
  href?: string;
  colSpan?: number;
  rowSpan?: number;
  variant?: "panel" | "open";
  fill?: boolean;
  padding?: "sm" | "md";
  gap?: "none" | "sm" | "md";
  interactive?: boolean;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  draggable?: boolean;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
  role?: string;
  tabIndex?: number;
  onKeyDown?: (e: KeyboardEvent) => void;
  ariaLabel?: string;
}) {
  const spanStyle: CSSProperties = {
    ...(colSpan ? { gridColumn: `span ${colSpan} / span ${colSpan}` } : {}),
    ...(rowSpan ? { gridRow: `span ${rowSpan} / span ${rowSpan}` } : {}),
    ...style,
  };

  const content = (
    <div
      className={clsx(
        variant === "panel" && "rtd-glass",
        interactive && "rtd-glass-interactive rounded-[var(--rtd-radius-card)]",
        fill && "h-full",
        "flex flex-col",
        GAP[gap],
        PADDING[padding],
        "min-w-0",
        (href || interactive) && "cursor-pointer",
        className
      )}
      style={spanStyle}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      role={role}
      tabIndex={tabIndex}
      onKeyDown={onKeyDown}
      aria-label={ariaLabel}
    >
      {label && <SectionHeader title={label} number={number} statusChip={statusChip} />}
      <div className={clsx("flex-1 min-h-0 flex flex-col", GAP[gap])}>{children}</div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="contents focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 rounded-[var(--rtd-radius-card)]">
        {content}
      </Link>
    );
  }
  return content;
}
