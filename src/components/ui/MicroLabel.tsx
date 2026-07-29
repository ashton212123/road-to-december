import { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

/** Miles OS micro label -- the spec's smallest text role (8px uppercase
 * mono, .15em tracking, --fg-dimmer): sub-tile captions, meta rows. Distinct
 * from the pre-existing `.rtd-micro-label` CSS class (11-12px, used across
 * the pre-Miles-OS app) -- that class stays untouched until its callers
 * convert screen by screen. */
export function MicroLabel({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={clsx("uppercase whitespace-nowrap", className)}
      style={{
        font: "500 8px/1 var(--rtd-font-mono)",
        letterSpacing: ".15em",
        color: "var(--rtd-mos-fg-dimmer)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
