import { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

export function GlassCard({
  children,
  className,
  padded = true,
  as: Tag = "div",
  style,
  interactive = false,
  /** "open" drops the glass background/border/shadow for an .rtd-open-section
   * look (loop 29 unboxing) -- same idea as BentoCard's variant prop, for the
   * handful of non-grid surfaces (e.g. NeedsAttentionList) built on GlassCard
   * instead. Default "card" is the original glass chrome, unchanged. */
  variant = "card",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "div" | "section" | "article";
  style?: CSSProperties;
  /** Set when the card itself is clickable (wrapped in onClick/Link) to get hover/focus/press feedback. */
  interactive?: boolean;
  variant?: "card" | "open";
  onClick?: () => void;
  tabIndex?: number;
}) {
  return (
    <Tag
      className={clsx(
        variant === "card" ? "rtd-glass" : "rtd-open-section",
        padded && variant === "card" && "p-3.5 md:p-4",
        interactive &&
          "rtd-glass-interactive cursor-pointer transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2",
        className
      )}
      style={style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
