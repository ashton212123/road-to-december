import { BentoCard } from "@/components/ui/BentoCard";
import { ComparisonLine, ComparisonLegend } from "@/components/ui/ComparisonLine";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function TrainingLoadCard({
  thisWeekDaily,
  lastWeekDaily,
  takeaway,
}: {
  thisWeekDaily: (number | null)[];
  lastWeekDaily: (number | null)[];
  takeaway: string | null;
}) {
  const hasAnyData = thisWeekDaily.some((v) => v !== null) || lastWeekDaily.some((v) => v !== null);

  return (
    <BentoCard label="Training load" colSpan={4} rowSpan={2}>
      {!hasAnyData ? (
        <div className="flex-1 flex items-center justify-center text-caption text-[var(--rtd-text-tertiary)]">Needs more data — log gym sessions</div>
      ) : (
        <>
          <ComparisonLegend currentLabel="This week" previousLabel="Last week" color="var(--rtd-domain-train)" />
          <div className="flex-1 min-h-0 mt-1">
            <ComparisonLine current={thisWeekDaily} previous={lastWeekDaily} color="var(--rtd-domain-train)" height={64} labels={DAY_LABELS} />
          </div>
          {takeaway && <p className="text-caption text-[var(--rtd-text-secondary)] mt-1 leading-snug">{takeaway}</p>}
        </>
      )}
    </BentoCard>
  );
}
