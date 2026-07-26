import type { PhaseWeek } from "@/lib/train/phaseWeek";

/** "Which week of which phase am I in" -- reused on both /train and
 * /train/[phaseId], same SectionLabel-adjacent pattern as everywhere else
 * in the app (rtd-micro-label + a semibold subtitle line). */
export function PhaseWeekHeader({ phaseWeek, isDeload }: { phaseWeek: PhaseWeek; isDeload: boolean }) {
  return (
    <div className="-mt-2 flex flex-col gap-0.5">
      <span className="rtd-micro-label">
        WEEK {phaseWeek.weekInPhase} OF {phaseWeek.totalWeeksInPhase}
      </span>
      <span className="text-body font-semibold text-[var(--rtd-text)]">{phaseWeek.label.split(" · ")[1]}</span>
      {isDeload && (
        <span className="text-caption text-[var(--rtd-text-tertiary)]">
          Deload week — the point is to arrive fresh, not to hit numbers.
        </span>
      )}
    </div>
  );
}
