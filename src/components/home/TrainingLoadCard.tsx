import Link from "next/link";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { ComparisonLine, ComparisonLegend } from "@/components/ui/ComparisonLine";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function TrainingLoadCard({
  thisWeekDaily,
  lastWeekDaily,
  takeaway,
  className,
}: {
  thisWeekDaily: (number | null)[];
  lastWeekDaily: (number | null)[];
  takeaway: string | null;
  className?: string;
}) {
  const hasAnyData = thisWeekDaily.some((v) => v !== null) || lastWeekDaily.some((v) => v !== null);

  return (
    <TerminalPanel variant="open" label="TRAINING LOAD" number="07" colSpan={4} rowSpan={2} className={className}>
      {!hasAnyData ? (
        <div className="flex-1 min-h-0 flex flex-col justify-end gap-1 pb-0.5">
          <div className="w-full border-t border-dashed" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
          <Link href="/train" className="text-caption text-[var(--rtd-text-tertiary)] underline decoration-dotted underline-offset-2 hover:text-[var(--rtd-text-secondary)]">
            Tracking starts after your first logged gym session
          </Link>
        </div>
      ) : (
        <>
          <ComparisonLegend currentLabel="This week" previousLabel="Last week" color="var(--rtd-domain-train)" />
          <div className="flex-1 min-h-0 mt-1">
            <ComparisonLine current={thisWeekDaily} previous={lastWeekDaily} color="var(--rtd-domain-train)" height={64} labels={DAY_LABELS} />
          </div>
          {takeaway && <p className="text-caption text-[var(--rtd-text-secondary)] mt-1 leading-snug">{takeaway}</p>}
        </>
      )}
    </TerminalPanel>
  );
}
