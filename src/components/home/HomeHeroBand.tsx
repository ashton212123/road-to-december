import clsx from "clsx";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { BentoCard } from "@/components/ui/BentoCard";
import type { ReadinessLight } from "@/lib/rules/readiness";

// Exported: the one green/yellow/red vocabulary every readiness-adjacent
// surface draws from (hero band, the new home doorway dials) so the mapping
// is never redefined twice and can't drift.
export const LIGHT_COLOR: Record<ReadinessLight, string> = {
  green: "var(--rtd-green)",
  yellow: "var(--rtd-orange)",
  red: "var(--rtd-red)",
};

export const LIGHT_WORD: Record<ReadinessLight, string> = {
  green: "Ready",
  yellow: "Caution",
  red: "Rest",
};

/** V4 P3: countdown + readiness merged into one hero surface -- one card,
 * one glow, two zones split by a radial-fade divider instead of two
 * separate boxed-in cards. */
export function HomeHeroBand({
  daysToNcaa,
  daysToAsean,
  aseanLabel,
  aseanDateLabel,
  aseanConfirmed,
  seasonPct,
  phaseTag,
  phaseName,
  weekNumber,
  readinessOverall,
  readinessSignals,
  actionLine,
  className,
}: {
  daysToNcaa: number;
  daysToAsean: number;
  aseanLabel: string;
  aseanDateLabel: string;
  aseanConfirmed: boolean | null;
  seasonPct: number;
  phaseTag: string;
  phaseName: string;
  weekNumber: number;
  readinessOverall: ReadinessLight;
  readinessSignals: { label: string; light: ReadinessLight; detail: string }[];
  actionLine: string;
  className?: string;
}) {
  return (
    <BentoCard colSpan={8} rowSpan={3} className={clsx("rtd-hero-glow", className)}>
      <div className="flex flex-col md:flex-row gap-4 md:gap-5 flex-1 min-h-0">
        <div className="flex-1 flex flex-col justify-between min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="rtd-micro-label">Days to NCAA · Dec 4</div>
              <div className="rtd-big-num mt-1">
                <AnimatedNumber value={daysToNcaa} />
              </div>
            </div>
            <span
              className="text-footnote font-semibold px-2.5 py-1 rounded-full shrink-0"
              style={{ background: "rgba(10,132,255,0.14)", color: "var(--rtd-blue)" }}
            >
              {phaseTag} · {phaseName} · Wk {weekNumber}
            </span>
          </div>

          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${seasonPct}%`, background: "var(--rtd-blue)" }} />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-caption text-[var(--rtd-text-secondary)]">{seasonPct}% through the 21-week season</span>
              <span className="text-caption text-[var(--rtd-text-tertiary)] rtd-nums">
                {aseanConfirmed !== false ? (
                  <>
                    <AnimatedNumber value={daysToAsean} /> to ASEAN · {aseanDateLabel}
                    {aseanConfirmed === null && " (unconfirmed)"}
                  </>
                ) : (
                  aseanLabel
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="rtd-divider md:hidden" />
        <div className="hidden md:block rtd-divider-v" />

        <div className="md:w-[300px] shrink-0 flex flex-col justify-between min-w-0">
          <div>
            <div className="rtd-micro-label">Readiness</div>
            <div className="rtd-big-num mt-1" style={{ color: LIGHT_COLOR[readinessOverall] }}>
              {LIGHT_WORD[readinessOverall]}
            </div>
            <p className="text-caption text-[var(--rtd-text-secondary)] mt-0.5">{actionLine}</p>
          </div>
          <div className="flex flex-col gap-1 mt-3">
            {readinessSignals.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: LIGHT_COLOR[s.light] }} />
                <span className="text-caption text-[var(--rtd-text-tertiary)] truncate">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </BentoCard>
  );
}
