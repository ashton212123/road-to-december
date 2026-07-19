import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

// "primary" is the DesignCode shiny-glass CTA (.rtd-btn-shiny in globals.css)
// -- dark glass + white border + violet/cyan glow underneath, not a solid
// fill. Reserved for the one main action per screen (Start session,
// Estimate, Save, coach Send). Everything else stays flat, just re-radiused
// to the 8px control system.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "rtd-btn-shiny text-white hover:brightness-110",
  secondary: "bg-white/[0.08] text-[var(--rtd-text)] border border-[var(--rtd-hairline)] hover:bg-white/[0.12] rounded-[8px]",
  ghost: "bg-transparent text-[var(--rtd-text-secondary)] hover:bg-white/[0.06] rounded-[8px]",
  danger: "bg-[var(--rtd-red)] text-white hover:brightness-110 rounded-[8px]",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={clsx(
        "min-h-11 px-4 py-2.5 text-subhead font-semibold cursor-pointer transition-[transform,background-color,filter] duration-150 ease-out active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
