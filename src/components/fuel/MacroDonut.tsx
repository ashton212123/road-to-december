"use client";

import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

type Macro = { label: string; loggedG: number; targetG: number; color: string; strokeWidth: number };

/** Concentric animated rings (protein outer/thickest, carbs middle, fat inner/thinnest —
 * "protein + carbs most prominent" per spec) with a legend. Reuses ProgressRing's
 * stroke-dashoffset CSS-transition technique, just layered per macro. */
export function MacroDonut({
  kcalLogged,
  kcalTarget,
  proteinLoggedG,
  proteinTargetG,
  carbsLoggedG,
  carbsTargetG,
  fatLoggedG,
  fatTargetG,
  size = 180,
}: {
  kcalLogged: number;
  kcalTarget: number;
  proteinLoggedG: number;
  proteinTargetG: number;
  carbsLoggedG: number;
  carbsTargetG: number;
  fatLoggedG: number;
  fatTargetG: number;
  size?: number;
}) {
  const macros: Macro[] = [
    { label: "Protein", loggedG: proteinLoggedG, targetG: proteinTargetG, color: "var(--rtd-green)", strokeWidth: 14 },
    { label: "Carbs", loggedG: carbsLoggedG, targetG: carbsTargetG, color: "var(--rtd-orange)", strokeWidth: 12 },
    { label: "Fat", loggedG: fatLoggedG, targetG: fatTargetG, color: "var(--rtd-cyan)", strokeWidth: 8 },
  ];

  const center = size / 2;
  let radius = center - 10;

  const rings = macros.map((m) => {
    const r = radius;
    radius -= m.strokeWidth + 3;
    const circumference = 2 * Math.PI * r;
    const pct = m.targetG > 0 ? Math.max(0, Math.min(100, (m.loggedG / m.targetG) * 100)) : 0;
    const offset = circumference * (1 - pct / 100);
    return { ...m, r, circumference, offset, pct };
  });

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {rings.map((ring) => (
            <circle key={`${ring.label}-track`} cx={center} cy={center} r={ring.r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={ring.strokeWidth} />
          ))}
          {rings.map((ring) => (
            <circle
              key={ring.label}
              cx={center}
              cy={center}
              r={ring.r}
              fill="none"
              stroke={ring.color}
              strokeWidth={ring.strokeWidth}
              strokeDasharray={ring.circumference}
              strokeDashoffset={ring.offset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.8s ease" }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-title-1 text-[var(--rtd-text)] rtd-mono">
            <AnimatedNumber value={kcalLogged} />
          </span>
          <span className="text-caption text-[var(--rtd-text-secondary)] rtd-mono">/ {kcalTarget} kcal</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {rings.map((ring) => (
          <div key={ring.label} className="flex items-center gap-2 text-footnote">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: ring.color }} />
            <span className="text-[var(--rtd-text-secondary)] w-14">{ring.label}</span>
            <span className="font-semibold text-[var(--rtd-text)] rtd-mono">
              {Math.round(ring.loggedG)}g <span className="text-[var(--rtd-text-secondary)] font-normal">/ {ring.targetG}g</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
