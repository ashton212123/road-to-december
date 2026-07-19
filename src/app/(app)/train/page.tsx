import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";
import { IconChevronRight, IconBolt } from "@/components/ui/icons";
import { getAllPhasesWithSessions, getCurrentPhase } from "@/lib/db/queries";
import { todayManilaISO, daysBetween } from "@/lib/time";
import { withRetry } from "@/lib/db/withRetry";

export default async function TrainPage() {
  const today = todayManilaISO();
  const allPhases = await withRetry(() => getAllPhasesWithSessions());
  const currentPhase = getCurrentPhase(allPhases, today);

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1">
      <SectionLabel>Train — 21-week program</SectionLabel>
      <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4 rtd-stagger">
        {allPhases.map((phase) => {
          const isCurrent = phase.id === currentPhase?.id;
          const hasExplosive = phase.sessions.some((s) => s.exercises.some((e) => e.isExplosive));
          const span = daysBetween(phase.startDate, phase.endDate) || 1;
          const pctComplete = Math.round(
            Math.max(0, Math.min(1, daysBetween(phase.startDate, today) / span)) * 100
          );
          return (
            <Link key={phase.id} href={`/train/${phase.id}`}>
              <GlassCard
                interactive
                className="flex flex-col gap-3"
                style={
                  isCurrent
                    ? { borderColor: `${phase.color}55`, boxShadow: `0 0 0 1px ${phase.color}33, var(--rtd-shadow)` }
                    : undefined
                }
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-footnote font-bold shrink-0"
                    style={{ background: `${phase.color}26`, color: phase.color }}
                  >
                    {phase.tag}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-body font-semibold truncate">{phase.name}</span>
                      {isCurrent && (
                        <span className="text-caption font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--rtd-blue)] text-white shrink-0">
                          Now
                        </span>
                      )}
                      {phase.isDeload && (
                        <span className="text-caption font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/10 text-[var(--rtd-text-secondary)] shrink-0">
                          Deload wk {phase.deloadWeek}
                        </span>
                      )}
                      {hasExplosive && <IconBolt />}
                    </div>
                    <div className="text-footnote text-[var(--rtd-text-tertiary)] truncate">
                      {phase.weeks} · {phase.dates}
                    </div>
                  </div>
                  <IconChevronRight className="md:hidden" />
                </div>
                <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pctComplete}%`, background: phase.color }}
                  />
                </div>
              </GlassCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
