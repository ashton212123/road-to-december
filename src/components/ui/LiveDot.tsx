import clsx from "clsx";

/** Miles OS live dot -- 4-5px pulsing circle marking a panel's data as
 * genuinely live right now (vs. a static count/ratio, which is what
 * StatusChip's `pulse` prop is for elsewhere in the app). Exact spec timing:
 * see rtd-mos-live-dot-pulse in globals.css. */
export function LiveDot({ size = 5, color = "var(--rtd-mos-green)", className }: { size?: number; color?: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx("inline-block rounded-full shrink-0 rtd-mos-live-dot", className)}
      style={{ width: size, height: size, background: color }}
    />
  );
}
