import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { BentoCard } from "@/components/ui/BentoCard";

export function CountdownHero({
  daysToNcaa,
  daysToAsean,
  aseanLabel,
  aseanDateLabel,
  aseanConfirmed,
  seasonPct,
  phaseTag,
  phaseName,
  weekNumber,
  trainingStreak,
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
  trainingStreak: number;
}) {
  return (
    <BentoCard colSpan={8} rowSpan={2} className="justify-between rtd-hero-glow">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="rtd-micro-label">Days to NCAA · Dec 4</div>
          <div className="rtd-display rtd-display-xl rtd-nums text-large-title mt-1" style={{ fontSize: "clamp(36px, 4vw + 20px, 56px)" }}>
            <AnimatedNumber value={daysToNcaa} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className="text-footnote font-semibold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(10,132,255,0.14)", color: "var(--rtd-blue)" }}
          >
            {phaseTag} · {phaseName} · Wk {weekNumber}
          </span>
          {trainingStreak > 0 && (
            <span className="text-footnote font-semibold px-2.5 py-1 rounded-full bg-[var(--rtd-orange)]/15 text-[var(--rtd-orange)]">
              🔥 {trainingStreak} day{trainingStreak === 1 ? "" : "s"}
            </span>
          )}
        </div>
      </div>

      <div>
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
    </BentoCard>
  );
}
