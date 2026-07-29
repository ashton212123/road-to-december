import { CSSProperties, ReactNode } from "react";
import clsx from "clsx";

/** Miles OS inset field -- the recessed surface used for kanban cards,
 * sub-tiles, and form-field wells inside a TerminalPanel. Exact recipe from
 * MILES-OS-UI-SPEC.md's Component recipes. */
export function InsetField({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div
      className={clsx("min-w-0", className)}
      style={{
        background: "var(--rtd-mos-panel-2)",
        border: "1px solid var(--rtd-mos-border-field)",
        borderRadius: "var(--rtd-radius-inset)",
        padding: "9px 11px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
