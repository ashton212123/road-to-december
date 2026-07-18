import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-[var(--rtd-blue)] text-white hover:brightness-110",
  secondary:
    "bg-white/[0.08] text-[var(--rtd-text)] border border-[var(--rtd-hairline)] hover:bg-white/[0.12]",
  ghost: "bg-transparent text-[var(--rtd-text-secondary)] hover:bg-white/[0.06]",
  danger: "bg-[var(--rtd-red)] text-white hover:brightness-110",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={clsx(
        "min-h-11 px-4 py-2.5 rounded-full text-subhead font-semibold cursor-pointer transition-[transform,background-color,filter] duration-150 ease-out active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none",
        VARIANT_CLASSES[variant],
        className
      )}
      {...props}
    />
  );
}
