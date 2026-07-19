import { BentoCard } from "@/components/ui/BentoCard";
import type { ReadinessLight } from "@/lib/rules/readiness";

const LIGHT_COLOR: Record<ReadinessLight, string> = {
  green: "var(--rtd-green)",
  yellow: "var(--rtd-orange)",
  red: "var(--rtd-red)",
};

const LIGHT_WORD: Record<ReadinessLight, string> = {
  green: "Ready",
  yellow: "Caution",
  red: "Rest",
};

export function ReadinessCard({
  overall,
  signals,
}: {
  overall: ReadinessLight;
  signals: { label: string; light: ReadinessLight; detail: string }[];
}) {
  return (
    <BentoCard label="Readiness" colSpan={4} rowSpan={2} className="justify-between">
      <div className="text-title-1 rtd-display" style={{ color: LIGHT_COLOR[overall] }}>
        {LIGHT_WORD[overall]}
      </div>
      <div className="flex flex-col gap-1 mt-1">
        {signals.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: LIGHT_COLOR[s.light] }} />
            <span className="text-caption text-[var(--rtd-text-tertiary)] truncate">{s.label}</span>
          </div>
        ))}
      </div>
    </BentoCard>
  );
}
