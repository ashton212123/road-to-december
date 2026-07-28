import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { IconChevronRight, IconBolt } from "@/components/ui/icons";
import { PhaseWeekHeader } from "@/components/train/PhaseWeekHeader";
import { getAllPhasesWithSessions, getCurrentPhase } from "@/lib/db/queries";
import { todayManilaISO, daysBetween } from "@/lib/time";
import { computePhaseWeek } from "@/lib/train/phaseWeek";
import { withRetry } from "@/lib/db/withRetry";

export default async function TrainPage() {
  const today = todayManilaISO();
  const allPhases = await withRetry(() => getAllPhasesWithSessions());
  const currentPhase = getCurrentPhase(allPhases, today);

  return (
    <div className="flex flex-col gap-4 pt-1">
      <SectionHeader title="Train — 21-week program" className="mb-2" />
      {currentPhase && <PhaseWeekHeader phaseWeek={computePhaseWeek(currentPhase, today)} isDeload={currentPhase.isDeload} />}
      <div className="flex flex-col gap-3 md:grid md:grid-cols-3 md:gap-4 rtd-stagger">
        {allPhases.map((phase) => {
          const isCurrent = phase.id === currentPhase?.id;
          const hasExplosive = phase.sessions.some((s) => s.exercises.some((e) => e.isExplosive));
          const span = daysBetween(phase.startDate, phase.endDate) || 1;
          const pctComplete = Math.round(
            Math.max(0, Math.min(1, daysBetween(phase.startDate, today) / span)) * 100
          );
          // prefetch={false}: six phase links prefetching at once spawned
          // parallel lambdas whose pools blew the Supabase connection
          // ceiling (the intermittent "database connection hiccup").
          return (
            <Link key={phase.id} href={`/train/${phase.id}`} prefetch={false}>
              <TerminalPanel
                interactive
                fill={false}
                style={isCurrent ? { borderColor: `${phase.color}55`, boxShadow: `0 0 0 1px ${phase.color}33` } : undefined}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-11 h-11 rounded-[8px] flex items-center justify-center text-footnote font-bold shrink-0"
                    style={{ background: `${phase.color}26`, color: phase.color }}
                  >
                    {phase.tag}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-body font-semibold truncate">{phase.name}</span>
                      {isCurrent && <StatusChip label="Now" tone="live" />}
                      {phase.isDeload && <StatusChip label={`Deload wk ${phase.deloadWeek}`} tone="warn" />}
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
              </TerminalPanel>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
