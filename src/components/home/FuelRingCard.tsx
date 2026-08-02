import Link from "next/link";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { HomeMealQuickLog } from "@/components/home/HomeMealQuickLog";

function MacroBar({ label, current, targetG, color }: { label: string; current: number; targetG: number; color: string }) {
  const pct = targetG > 0 ? Math.min(100, (current / targetG) * 100) : 0;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-2 text-caption">
        <span className="text-[var(--rtd-text-tertiary)] min-w-0 truncate">{label}</span>
        <span className="text-[var(--rtd-text-secondary)] rtd-nums rtd-mono shrink-0">
          {Math.round(current)}/{Math.round(targetG)}g
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/** Whoop-style unified fuel card (V4 P3) -- replaces the separate Kcal/
 * Protein StatCards. One ring carries the headline number (kcal remaining);
 * P/C/F + water are secondary, slim capsule bars beside it. The ring/bars
 * row taps through to the detailed rings on /fuel (§4e/WS5 §0 -- the panel
 * itself stopped being the link once the quick-log input below it needed
 * its own clicks, so only this row carries href now). */
export function FuelRingCard({
  kcalToday,
  kcalTargetMid,
  proteinToday,
  proteinTargetG,
  carbsToday,
  carbsTargetG,
  fatToday,
  fatTargetG,
  waterMl,
  waterTargetMl,
  className,
}: {
  kcalToday: number;
  kcalTargetMid: number;
  proteinToday: number;
  proteinTargetG: number;
  carbsToday: number;
  carbsTargetG: number;
  fatToday: number;
  fatTargetG: number;
  waterMl: number;
  waterTargetMl: number;
  className?: string;
}) {
  const remaining = kcalTargetMid - kcalToday;
  const kcalPct = kcalTargetMid > 0 ? (kcalToday / kcalTargetMid) * 100 : 0;
  const waterPct = waterTargetMl > 0 ? Math.min(100, (waterMl / waterTargetMl) * 100) : 0;

  return (
    <TerminalPanel label="NUTRITION" number="06" colSpan={4} rowSpan={2} className={className}>
      <Link href="/fuel" className="flex items-center gap-4 flex-1 min-h-0 rtd-tap-target">
        <ProgressRing
          pct={kcalPct}
          size={88}
          strokeWidth={8}
          gradient={["var(--rtd-orange)", "#ff375f"]}
          glow
          label={`${Math.abs(Math.round(remaining)).toLocaleString()}`}
          sub={remaining >= 0 ? "left" : "over"}
          ariaLabel={`Calories: ${kcalToday} of ${kcalTargetMid}`}
          className="shrink-0"
        />
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <MacroBar label="Protein" current={proteinToday} targetG={proteinTargetG} color="var(--rtd-green)" />
          <MacroBar label="Carbs" current={carbsToday} targetG={carbsTargetG} color="var(--rtd-blue)" />
          <MacroBar label="Fat" current={fatToday} targetG={fatTargetG} color="var(--rtd-purple)" />
          <div className="flex items-baseline justify-between gap-2 text-caption">
            <span className="text-[var(--rtd-text-tertiary)] min-w-0 truncate">Water</span>
            <span className="text-[var(--rtd-text-secondary)] rtd-nums rtd-mono shrink-0">
              {(waterMl / 1000).toFixed(1)}/{(waterTargetMl / 1000).toFixed(1)}L
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden -mt-1">
            <div
              className="h-full rounded-full"
              style={{ width: `${waterPct}%`, background: "linear-gradient(90deg, var(--rtd-cyan), var(--rtd-blue))" }}
            />
          </div>
        </div>
      </Link>
      <HomeMealQuickLog />
    </TerminalPanel>
  );
}
