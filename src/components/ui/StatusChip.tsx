import clsx from "clsx";

export type StatusTone = "ok" | "warn" | "danger" | "live" | "neutral" | "hot" | "warm" | "cool";

const TONE_COLOR: Record<"ok" | "warn" | "danger" | "live" | "neutral", string> = {
  ok: "var(--rtd-ok)",
  warn: "var(--rtd-warn)",
  danger: "var(--rtd-danger)",
  live: "var(--rtd-blue)",
  neutral: "var(--rtd-text-tertiary)",
};

// Miles OS HOT/WARM/COOL: exact bg/border/text triples from
// MILES-OS-UI-SPEC.md's status chip pattern, not the color-mix formula the
// pre-existing tones use below -- and a rectangular badge shape (3px
// radius), not the pill shape those tones render as.
const MOS_TONE_STYLE: Record<"hot" | "warm" | "cool", { bg: string; border: string; text: string }> = {
  hot: { bg: "var(--rtd-mos-hot-bg)", border: "var(--rtd-mos-hot-border)", text: "var(--rtd-mos-hot-text)" },
  warm: { bg: "var(--rtd-mos-warm-bg)", border: "var(--rtd-mos-warm-border)", text: "var(--rtd-mos-warm-text)" },
  cool: { bg: "var(--rtd-mos-cool-bg)", border: "var(--rtd-mos-cool-border)", text: "var(--rtd-mos-cool-text)" },
};

/** Phase 9 (§9a): small uppercase mono pill for a section's live status --
 * `LIVE`, `0/6 · 0%`, `7 ACTIVE`. `pulse` adds a small dot for states that
 * are genuinely "live" right now (vs. a static count/ratio).
 *
 * hot/warm/cool are the Miles OS additions (Key Blockers' STUCK badges) --
 * a distinct rectangular badge shape and exact spec colors, layered onto
 * this same component rather than a separate one since every other prop
 * (label, pulse) behaves identically. */
export function StatusChip({ label, tone = "neutral", pulse = false, className }: { label: string; tone?: StatusTone; pulse?: boolean; className?: string }) {
  const isMos = tone === "hot" || tone === "warm" || tone === "cool";

  if (isMos) {
    const mos = MOS_TONE_STYLE[tone as "hot" | "warm" | "cool"];
    return (
      <span
        className={clsx(
          "inline-flex items-center gap-1.5 uppercase border shrink-0 whitespace-nowrap",
          className
        )}
        style={{
          font: "500 8px/1.4 var(--rtd-font-mono)",
          letterSpacing: ".11em",
          padding: "2px 6px",
          borderRadius: "var(--rtd-radius-chip)",
          color: mos.text,
          borderColor: mos.border,
          background: mos.bg,
        }}
      >
        {pulse && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ background: mos.text }} />}
        {label}
      </span>
    );
  }

  const color = TONE_COLOR[tone as "ok" | "warn" | "danger" | "live" | "neutral"];
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
