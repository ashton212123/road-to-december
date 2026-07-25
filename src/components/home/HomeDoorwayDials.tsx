import Link from "next/link";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { LIGHT_COLOR, LIGHT_WORD } from "./HomeHeroBand";
import type { ReadinessLight } from "@/lib/rules/readiness";

/**
 * Whoop-style doorway dials (LOOP_PHASE5_PROMPT.md P5): a small number of
 * hero dials, each "a doorway, not a destination" -- the whole dial is a
 * Link to its own detail page, sitting directly on the wallpaper with no
 * card box around it. No invented composite score anywhere: Readiness's
 * ring fill is literally the share of green signals, labeled as exactly
 * that ("3/4 signals green"), never a fabricated 0-100 number.
 */
export function HomeDoorwayDials({
  readinessOverall,
  greenSignalCount,
  totalSignalCount,
  kcalToday,
  kcalTargetMid,
  consistencyPct,
  className,
}: {
  readinessOverall: ReadinessLight;
  greenSignalCount: number;
  totalSignalCount: number;
  kcalToday: number;
  kcalTargetMid: number;
  consistencyPct: number | null;
  className?: string;
}) {
  const readinessPct = totalSignalCount > 0 ? (greenSignalCount / totalSignalCount) * 100 : 0;
  const kcalPct = kcalTargetMid > 0 ? (kcalToday / kcalTargetMid) * 100 : 0;
  const kcalRemaining = kcalTargetMid - kcalToday;
  const consistencyRingPct = consistencyPct ?? 0;

  return (
    <div className={`grid grid-cols-3 gap-2 ${className ?? ""}`}>
      <Link
        href="/more/recovery"
        className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out rounded-2xl focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
      >
        <ProgressRing
          pct={readinessPct}
          className="w-24 h-24 md:w-28 md:h-28"
          strokeWidth={8}
          color={LIGHT_COLOR[readinessOverall]}
          glow
          label={LIGHT_WORD[readinessOverall]}
          sub={`${greenSignalCount}/${totalSignalCount} signals green`}
          ariaLabel={`Readiness: ${LIGHT_WORD[readinessOverall]}, ${greenSignalCount} of ${totalSignalCount} signals green`}
        />
        <span className="text-caption font-semibold text-[var(--rtd-text-secondary)]">Readiness</span>
      </Link>

      <Link
        href="/fuel"
        className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out rounded-2xl focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
      >
        <ProgressRing
          pct={kcalPct}
          className="w-24 h-24 md:w-28 md:h-28"
          strokeWidth={8}
          gradient={["var(--rtd-orange)", "#ff375f"]}
          glow
          label={`${Math.abs(Math.round(kcalRemaining)).toLocaleString()}`}
          sub={kcalRemaining >= 0 ? "kcal left" : "kcal over"}
          ariaLabel={`Fuel: ${kcalToday} of ${kcalTargetMid} calories`}
        />
        <span className="text-caption font-semibold text-[var(--rtd-text-secondary)]">Fuel</span>
      </Link>

      <Link
        href="/train"
        className="flex flex-col items-center gap-1.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out rounded-2xl focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
      >
        <ProgressRing
          pct={consistencyRingPct}
          className="w-24 h-24 md:w-28 md:h-28"
          strokeWidth={8}
          color="var(--rtd-blue)"
          glow
          label={consistencyPct !== null ? `${consistencyPct}%` : "—"}
          sub="4wk consistency"
          ariaLabel={`Consistency: ${consistencyPct !== null ? `${consistencyPct}%` : "no data yet"}`}
        />
        <span className="text-caption font-semibold text-[var(--rtd-text-secondary)]">Consistency</span>
      </Link>
    </div>
  );
}
