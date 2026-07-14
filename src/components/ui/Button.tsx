import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-[var(--rtd-blue)] text-white",
  secondary: "bg-white/[0.08] text-[var(--rtd-text)] border border-[var(--rtd-hairline)]",
  ghost: "bg-transparent text-[var(--rtd-text-secondary)]",
  danger: "bg-[var(--rtd-red)] text-white",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={clsx(
        "px-4 py-2.5 rounded-full text-sm font-semibold transition-transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
