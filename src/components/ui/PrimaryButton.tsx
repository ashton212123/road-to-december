import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

/** Miles OS primary button -- dense mono micro-action (e.g. "CAPTURE",
 * "SEAL WEEK"), distinct from the app-wide Button's larger "primary" CTA
 * variant used elsewhere. Exact recipe (including padding/radius, confirmed
 * against the live reference kit's CAPTURE button) from
 * MILES-OS-UI-SPEC.md's Component recipes. */
export function PrimaryButton({ className, style, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "cursor-pointer uppercase whitespace-nowrap inline-flex items-center gap-1.5 transition-[filter] duration-150 ease-out hover:brightness-110 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none",
        className
      )}
      style={{
        border: "1px solid rgba(122,184,232,.22)",
        background: "rgba(122,184,232,.10)",
        color: "var(--rtd-mos-blue)",
        font: "500 var(--rtd-mos-fs-meta)/1 var(--rtd-font-mono)",
        letterSpacing: ".12em",
        borderRadius: "var(--rtd-radius-button)",
        padding: "5px 10px",
        ...style,
      }}
      {...props}
    />
  );
}
