import { notFound } from "next/navigation";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { DaySelector } from "@/components/train/DaySelector";
import { ExerciseCard } from "@/components/train/ExerciseCard";
import { TaperChecklist } from "@/components/train/TaperChecklist";
import {
  getPhaseById,
  getLastSessionSetsForExercise,
  getTodaysSetsForExercise,
  getSettingsRow,
} from "@/lib/db/queries";
import { todayManilaISO, todayDayKey } from "@/lib/time";
import { suggestNextLoad } from "@/lib/train/progression";

export default async function PhaseSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ phaseId: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { phaseId } = await params;
  const { day } = await searchParams;

  const phase = await getPhaseById(phaseId);
  if (!phase) notFound();

  if (phase.isRaceBlock) {
    const settingsRow = await getSettingsRow();
    const condition = settingsRow.aseanConfirmed === true ? "asean_confirmed" : settingsRow.aseanConfirmed === false ? "asean_cancelled" : null;
    const blocks = (phase.blocks ?? []).filter(
      (b) => b.condition === "always" || b.condition === condition || (condition === null && b.condition !== "asean_cancelled")
    );
    return (
      <div className="flex flex-col gap-4 rtd-fade-in pt-1">
        <SectionLabel>
          {phase.tag} · {phase.name}
        </SectionLabel>
        <GlassCard className="text-xs text-[var(--rtd-text-secondary)]">{phase.note}</GlassCard>
        <TaperChecklist blocks={blocks} />
      </div>
    );
  }

  const availableDays = phase.sessions.map((s) => s.dayKey);
  const defaultDay = availableDays.includes(todayDayKey()) ? todayDayKey() : availableDays[0];
  const selectedDay = day && availableDays.includes(day) ? day : defaultDay;
  const session = phase.sessions.find((s) => s.dayKey === selectedDay);
  const today = todayManilaISO();

  const exerciseData = session
    ? await Promise.all(
        session.exercises.map(async (ex) => {
          const [lastSessionSets, todaysSets] = await Promise.all([
            getLastSessionSetsForExercise(ex.id),
            getTodaysSetsForExercise(ex.id, today),
          ]);
          const progression = suggestNextLoad({
            phaseId: phase.id,
            lastSessionSets: lastSessionSets.map((s) => ({
              weightKg: s.weightKg ? Number(s.weightKg) : null,
              reps: s.reps,
              rpe: s.rpe ? Number(s.rpe) : null,
            })),
            rpeTargetMax: ex.rpeMax ? Number(ex.rpeMax) : null,
            waveScheme: phase.waveScheme,
          });
          return { exercise: ex, lastSessionSets, todaysSets, progression };
        })
      )
    : [];

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1">
      <SectionLabel>
        {phase.tag} · {phase.name}
      </SectionLabel>
      {phase.note && <p className="text-xs text-[var(--rtd-text-tertiary)] -mt-2">{phase.note}</p>}
      <DaySelector phaseId={phase.id} days={availableDays} current={selectedDay} />

      {session ? (
        <>
          <div className="text-sm font-semibold">{session.title}</div>
          <div className="flex flex-col gap-3">
            {exerciseData.map(({ exercise, lastSessionSets, todaysSets, progression }) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                phaseId={phase.id}
                lastSessionSets={lastSessionSets}
                todaysSets={todaysSets}
                progression={progression}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState title="No session for this day" body="Pick another day above." />
      )}
    </div>
  );
}
