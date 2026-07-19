import { BentoCard } from "@/components/ui/BentoCard";

type WeeklyTonnageRow = { weekStart: string; total: number };

export function TrainingLoadCard({ weeks, takeaway }: { weeks: WeeklyTonnageRow[]; takeaway: string | null }) {
  const max = Math.max(1, ...weeks.map((w) => w.total));

  return (
    <BentoCard label="Training load" colSpan={4} rowSpan={2}>
      {weeks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-caption text-[var(--rtd-text-tertiary)]">Needs more data — log gym sessions</div>
      ) : (
        <>
          <div className="flex-1 flex items-end gap-1 min-h-0">
            {weeks.map((w) => (
              <div
                key={w.weekStart}
                className="flex-1 rounded-t-sm bg-[var(--rtd-blue)]"
                style={{ height: `${Math.max(4, (w.total / max) * 100)}%`, opacity: 0.85 }}
                title={`${w.weekStart}: ${Math.round(w.total)}kg`}
              />
            ))}
          </div>
          {takeaway && <p className="text-caption text-[var(--rtd-text-secondary)] mt-1.5 leading-snug">{takeaway}</p>}
        </>
      )}
    </BentoCard>
  );
}
