import { BentoCard } from "@/components/ui/BentoCard";
import { DeltaChip } from "@/components/ui/DeltaChip";
import type { PrEntry } from "@/lib/dashboard/recentPRs";

export function RecentPRsCard({ prs }: { prs: PrEntry[] }) {
  return (
    <BentoCard label="Recent PRs" colSpan={4} rowSpan={2}>
      {prs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-caption text-[var(--rtd-text-tertiary)] text-center">
          Needs more data — log a few sessions to start tracking PRs
        </div>
      ) : (
        <div className="flex flex-col gap-2 flex-1 justify-center">
          {prs.map((pr) => (
            <div key={`${pr.kind}-${pr.name}-${pr.date}`} className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <div className="text-subhead font-medium text-[var(--rtd-text)] truncate">{pr.name}</div>
                <div className="text-caption text-[var(--rtd-text-tertiary)] rtd-nums">
                  {pr.valueLabel} · {pr.date}
                </div>
              </div>
              <DeltaChip pct={pr.deltaPct} goodDirection="up" />
            </div>
          ))}
        </div>
      )}
    </BentoCard>
  );
}
