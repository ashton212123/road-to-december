import { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

/** Miles OS serif accent -- Instrument Serif italic, reserved for greetings,
 * name accents, and weekday words per the spec. Never for body text or data. */
export function SerifAccent({
  children,
  className,
  style,
  size = 24,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  size?: number;
}) {
  return (
    <span
      className={clsx(className)}
      style={{
        fontFamily: "var(--rtd-font-serif)",
        fontStyle: "italic",
        fontSize: size,
        color: "var(--rtd-mos-fg-strong)",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
