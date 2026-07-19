import { BentoCard } from "@/components/ui/BentoCard";

const LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function TrainWeekDots({ scheduled, logged }: { scheduled: boolean[]; logged: boolean[] }) {
  return (
    <BentoCard label="This week" colSpan={4} rowSpan={2}>
      <div className="flex-1 flex items-center justify-between gap-1">
        {LABELS.map((label, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <span className="text-caption text-[var(--rtd-text-tertiary)]">{label}</span>
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: !scheduled[i]
                  ? "rgba(255,255,255,0.06)"
                  : logged[i]
                    ? "var(--rtd-green)"
                    : "var(--rtd-domain-train)",
                opacity: !scheduled[i] ? 1 : logged[i] ? 1 : 0.35,
              }}
            />
          </div>
        ))}
      </div>
    </BentoCard>
  );
}
