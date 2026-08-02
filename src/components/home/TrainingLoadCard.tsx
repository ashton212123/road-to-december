import Link from "next/link";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { ComparisonLine, ComparisonLegend } from "@/components/ui/ComparisonLine";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function TrainingLoadCard({
  thisWeekDaily,
  lastWeekDaily,
  verdict,
  takeaway,
  className,
}: {
  thisWeekDaily: (number | null)[];
  lastWeekDaily: (number | null)[];
  /** One-line lead-in shown by default; `takeaway` is the full, citation-
   * bearing paragraph behind the disclosure below it (§4f/WS5 §0). */
  verdict: string | null;
  takeaway: string | null;
  className?: string;
}) {
  const hasAnyData = thisWeekDaily.some((v) => v !== null) || lastWeekDaily.some((v) => v !== null);

  return (
    <TerminalPanel variant="open" label="TRAINING LOAD" number="07" colSpan={4} rowSpan={2} className={className}>
      {!hasAnyData ? (
        <div className="flex-1 min-h-0 flex flex-col justify-end gap-1 pb-0.5">
          <div className="w-full border-t border-dashed" style={{ borderColor: "rgba(255,255,255,0.1)" }} />
          <Link href="/train" className="rtd-tap-target text-caption text-[var(--rtd-text-tertiary)] underline decoration-dotted underline-offset-2 hover:text-[var(--rtd-text-secondary)]">
            Tracking starts after your first logged gym session
          </Link>
        </div>
      ) : (
        <>
          <ComparisonLegend currentLabel="This week" previousLabel="Last week" color="var(--rtd-domain-train)" />
          <div className="flex-1 min-h-0 mt-1">
            <ComparisonLine current={thisWeekDaily} previous={lastWeekDaily} color="var(--rtd-domain-train)" height={64} labels={DAY_LABELS} />
          </div>
          {verdict && (
            <details className="mt-1 group">
              <summary className="text-caption text-[var(--rtd-text-secondary)] leading-snug cursor-pointer list-none rtd-tap-target marker:content-none">
                {verdict}
                <span className="text-[var(--rtd-text-tertiary)] ml-1 group-open:hidden">more</span>
              </summary>
              {takeaway && <p className="text-caption text-[var(--rtd-text-secondary)] mt-1 leading-snug">{takeaway}</p>}
            </details>
          )}
        </>
      )}
    </TerminalPanel>
  );
}
