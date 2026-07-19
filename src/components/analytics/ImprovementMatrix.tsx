import { BentoCard } from "@/components/ui/BentoCard";
import { IconTile } from "@/components/ui/IconTile";
import { Sparkline } from "@/components/ui/Sparkline";
import { DeltaChip } from "@/components/ui/DeltaChip";
import { DotStrip } from "@/components/ui/DotStrip";
import { IconBolt } from "@/components/ui/icons";
import type { MatrixRow } from "@/lib/analytics/improvementMatrix";

function detailAnchor(key: string): string {
  if (key.startsWith("strength-")) return "#detail-strength";
  if (key.startsWith("swim-")) return "#detail-swim";
  if (key === "bodyweight") return "#detail-body";
  if (key === "tonnage" || key === "gym-sessions") return "#detail-load";
  if (key === "protein-adherence" || key === "kcal-adherence") return "#detail-fuel";
  return "#detail-recovery";
}

function formatValue(v: number | null, unit: string, decimals: number): string {
  if (v === null) return "—";
  return `${v.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

export function ImprovementMatrix({ rows }: { rows: MatrixRow[] }) {
  return (
    <BentoCard label="Improvement matrix" colSpan={12}>
      <div className="flex flex-col rtd-divide-y">
        {rows.map((row) => (
          <a
            key={row.key}
            href={detailAnchor(row.key)}
            className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-white/[0.03] rounded-lg px-1.5 -mx-1.5 transition-colors duration-150 ease-out cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
          >
            <IconTile color={row.domainColor}>
              <IconBolt />
            </IconTile>
            <span className="w-36 shrink-0 text-subhead font-medium text-[var(--rtd-text)] truncate">{row.label}</span>

            {row.needsDataHint ? (
              <span className="flex-1 text-caption text-[var(--rtd-text-tertiary)] truncate">{row.needsDataHint}</span>
            ) : (
              <>
                <div className="w-24 shrink-0 hidden sm:block">
                  <Sparkline points={row.sparkline} color={row.domainColor} width={90} height={28} />
                </div>
                <span className="w-20 shrink-0 text-subhead rtd-nums text-right text-[var(--rtd-text)]">
                  {formatValue(row.current, row.unit, row.decimals)}
                </span>
                <span className="w-20 shrink-0 text-caption rtd-nums text-right text-[var(--rtd-text-tertiary)] hidden md:inline">
                  {formatValue(row.previous, row.unit, row.decimals)}
                </span>
                <div className="w-16 shrink-0 flex justify-end">
                  <DeltaChip pct={row.deltaPct} goodDirection={row.goodDirection} />
                </div>
                <div className="w-24 shrink-0 hidden lg:flex justify-end">
                  <DotStrip periods={row.dots} />
                </div>
              </>
            )}
          </a>
        ))}
      </div>
    </BentoCard>
  );
}
