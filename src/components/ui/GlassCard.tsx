import { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

export function GlassCard({
  children,
  className,
  padded = true,
  as: Tag = "div",
  style,
  interactive = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  as?: "div" | "section" | "article";
  style?: CSSProperties;
  /** Set when the card itself is clickable (wrapped in onClick/Link) to get hover/focus/press feedback. */
  interactive?: boolean;
  onClick?: () => void;
  tabIndex?: number;
}) {
  return (
    <Tag
      className={clsx(
        "rtd-glass",
        padded && "p-4",
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
