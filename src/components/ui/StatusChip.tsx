import clsx from "clsx";

export type StatusTone = "ok" | "warn" | "danger" | "live" | "neutral";

const TONE_COLOR: Record<StatusTone, string> = {
  ok: "var(--rtd-ok)",
  warn: "var(--rtd-warn)",
  danger: "var(--rtd-danger)",
  live: "var(--rtd-blue)",
  neutral: "var(--rtd-text-tertiary)",
};

/** Phase 9 (§9a): small uppercase mono pill for a section's live status --
 * `LIVE`, `0/6 · 0%`, `7 ACTIVE`. `pulse` adds a small dot for states that
 * are genuinely "live" right now (vs. a static count/ratio). */
export function StatusChip({ label, tone = "neutral", pulse = false, className }: { label: string; tone?: StatusTone; pulse?: boolean; className?: string }) {
  const color = TONE_COLOR[tone];
  return (
    <span
      className={clsx(
        "rtd-mono inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] px-2 py-0.5 rounded-full border shrink-0 whitespace-nowrap",
        className
      )}
      style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)`, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {pulse && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
      {label}
    </span>
  );
}
