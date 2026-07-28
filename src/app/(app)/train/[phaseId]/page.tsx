import { notFound } from "next/navigation";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { DaySelector } from "@/components/train/DaySelector";
import { WorkoutSession } from "@/components/train/WorkoutSession";
import { PhaseWeekHeader } from "@/components/train/PhaseWeekHeader";
import { TaperChecklist } from "@/components/train/TaperChecklist";
import { TrainWeekDots } from "@/components/train/TrainWeekDots";
import { ImportSessionButton } from "@/components/train/ImportSessionButton";
import { TaperPlanCard } from "@/components/swim/TaperPlanCard";
import {
  getPhaseById,
  getSessionWorkoutData,
  getSettingsRow,
  getWorkoutLogsSince,
  getAllMeetsWithEvents,
  getSwimSessions,
} from "@/lib/db/queries";
import { todayManilaISO, todayDayKey, mondayOf, addDaysISO } from "@/lib/time";
import { suggestNextLoad } from "@/lib/train/progression";
import { computePhaseWeek } from "@/lib/train/phaseWeek";
import { buildTaperPlan } from "@/lib/swim/taper";
import type { ZoneDistance } from "@/lib/swim/zones";
import { withRetry } from "@/lib/db/withRetry";
import type { workoutLogs } from "@/lib/db/schema";

const DAY_KEY_TO_INDEX: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

type WorkoutLogRow = typeof workoutLogs.$inferSelect;

export default async function PhaseSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ phaseId: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { phaseId } = await params;
  const { day } = await searchParams;

  const phase = await withRetry(() => getPhaseById(phaseId));
  if (!phase) notFound();

  const today = todayManilaISO();
  const phaseWeek = computePhaseWeek(phase, today);

  if (phase.isRaceBlock) {
    const [settingsRow, allMeets, swimSessions] = await withRetry(() =>
      Promise.all([getSettingsRow(), getAllMeetsWithEvents(), getSwimSessions(60)])
    );
    const condition = settingsRow.aseanConfirmed === true ? "asean_confirmed" : settingsRow.aseanConfirmed === false ? "asean_cancelled" : null;
    const blocks = (phase.blocks ?? []).filter(
      (b) => b.condition === "always" || b.condition === condition || (condition === null && b.condition !== "asean_cancelled")
    );

    const nextMeet = allMeets.filter((m) => m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null;
    const thisMonday = mondayOf(today);
    const totalByWeek = new Map<string, number>();
    const zoneByWeek = new Map<string, ZoneDistance>();
    for (const s of swimSessions) {
      const wk = mondayOf(s.date);
      totalByWeek.set(wk, (totalByWeek.get(wk) ?? 0) + (s.parsedDistanceM ?? 0));
      const cur = zoneByWeek.get(wk) ?? {};
      for (const [z, m] of Object.entries((s.zoneDistanceM as ZoneDistance | null) ?? {})) {
        const zone = z as keyof ZoneDistance;
        cur[zone] = (cur[zone] ?? 0) + (m ?? 0);
      }
      zoneByWeek.set(wk, cur);
    }
    const weeklyVolume = Array.from({ length: 8 }, (_, i) => {
      const weekStart = addDaysISO(thisMonday, -7 * (7 - i));
      return { weekStart, totalM: totalByWeek.get(weekStart) ?? 0, zoneDistance: zoneByWeek.get(weekStart) ?? {} };
    });
    const taperPlan = nextMeet ? buildTaperPlan({ todayISO: today, meetDateISO: nextMeet.date, weeklyVolume }) : null;

    return (
      <div className="flex flex-col gap-4 pt-1">
        <SectionHeader title={`${phase.tag} · ${phase.name}`} className="mb-2" />
        <PhaseWeekHeader phaseWeek={phaseWeek} isDeload={phase.isDeload} />
        <TerminalPanel fill={false} className="text-subhead text-[var(--rtd-text-secondary)]">
          {phase.note}
        </TerminalPanel>
        {taperPlan && nextMeet && <TaperPlanCard plan={taperPlan} meetName={nextMeet.name} />}
        <TaperChecklist blocks={blocks} />
      </div>
    );
  }

  const availableDays = phase.sessions.map((s) => s.dayKey);
  const defaultDay = availableDays.includes(todayDayKey()) ? todayDayKey() : availableDays[0];
  const selectedDay = day && availableDays.includes(day) ? day : defaultDay;
  const session = phase.sessions.find((s) => s.dayKey === selectedDay);

  const weekStart = mondayOf(today);

  // Three queries total for the whole session, not two per exercise, plus
  // one more for the week-dots widget and one for the unit preference --
  // still one batched round trip.
  const [{ todaysByExercise, lastSessionByExercise }, weekLogs, settingsRow] = await withRetry(() =>
    Promise.all([
      session
        ? getSessionWorkoutData(session.exercises.map((e) => e.id), today)
        : Promise.resolve({ todaysByExercise: new Map<number, WorkoutLogRow[]>(), lastSessionByExercise: new Map<number, WorkoutLogRow[]>() }),
      getWorkoutLogsSince(weekStart),
      getSettingsRow(),
    ])
  );
  const weightUnit = settingsRow.weightUnit as "kg" | "lb";
  const loggedDatesThisWeek = new Set(weekLogs.map((l) => l.date));
  const scheduledDayIndexes = new Set(phase.sessions.map((s) => DAY_KEY_TO_INDEX[s.dayKey]));
  const weekScheduled = [0, 1, 2, 3, 4, 5, 6].map((i) => scheduledDayIndexes.has(i));
  const weekLogged = [0, 1, 2, 3, 4, 5, 6].map((i) => loggedDatesThisWeek.has(addDaysISO(weekStart, i)));

  const exerciseData = (session?.exercises ?? []).map((ex) => {
    const lastSessionSetsRaw = lastSessionByExercise.get(ex.id) ?? [];
    const todaysSets = todaysByExercise.get(ex.id) ?? [];
    const lastSessionSets = lastSessionSetsRaw.map((s) => ({
      weightKg: s.weightKg,
      reps: s.reps,
      rpe: s.rpe,
    }));
    const lastSessionSetsNum = lastSessionSets.map((s) => ({
      weightKg: s.weightKg ? Number(s.weightKg) : null,
      reps: s.reps,
      rpe: s.rpe ? Number(s.rpe) : null,
    }));
    const progression = suggestNextLoad({
      phaseId: phase.id,
      lastSessionSets: lastSessionSetsNum,
      rpeTargetMax: ex.rpeMax ? Number(ex.rpeMax) : null,
      waveScheme: phase.waveScheme,
    });
    const lastSessionTopWeight = lastSessionSetsNum.reduce<number | null>((best, s) => {
      if (s.weightKg === null) return best;
      return best === null || s.weightKg > best ? s.weightKg : best;
    }, null);
    // Fallback chain: stored default -> progression suggestion -> last
    // session's top weight -> null (never fabricated, never nagged about).
    const resolvedDefaultWeightKg =
      (ex.defaultWeightKg !== null && ex.defaultWeightKg !== undefined ? Number(ex.defaultWeightKg) : null) ??
      progression?.suggestedWeightKg ??
      lastSessionTopWeight;
    // Explosive-intent movements (box jump, broad jump, med-ball throws) are
    // bodyweight by nature no matter what the prescription table says --
    // "why would I need to put a weight in for a box jump? it's literally
    // jumping." Otherwise, an exercise only counts as loaded if there's real
    // evidence of load: a prescribed %1RM, a stored/learned default weight,
    // or a weight actually logged for it before.
    const hasHistoricalWeight = lastSessionSetsNum.some((s) => s.weightKg !== null);
    const hasPct1rm = (ex.pct1rmMin !== null && ex.pct1rmMin !== undefined) || (ex.pct1rmMax !== null && ex.pct1rmMax !== undefined);
    const hasStoredDefault = ex.defaultWeightKg !== null && ex.defaultWeightKg !== undefined;
    const hasLoad = !ex.isExplosive && (hasPct1rm || hasStoredDefault || hasHistoricalWeight);
    return { exercise: { ...ex, hasLoad }, lastSessionSets, todaysSets, progression, resolvedDefaultWeightKg };
  });

  return (
    <div className="flex flex-col gap-4 pt-1">
      <SectionHeader title={`${phase.tag} · ${phase.name}`} className="mb-2" />
      <PhaseWeekHeader phaseWeek={phaseWeek} isDeload={phase.isDeload} />
      {phase.note && <p className="text-subhead text-[var(--rtd-text-secondary)] -mt-2">{phase.note}</p>}
      <DaySelector phaseId={phase.id} days={availableDays} current={selectedDay} />

      {session ? (
        <>
          <div className="rtd-bento-grid">
            <TerminalPanel colSpan={8} rowSpan={2} className="justify-center">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-body font-semibold text-[var(--rtd-text)]">{session.title}</div>
                  <div className="text-footnote text-[var(--rtd-text-tertiary)] mt-1">
                    {session.exercises.length} exercise{session.exercises.length === 1 ? "" : "s"}
                  </div>
                </div>
                {selectedDay === todayDayKey() && (
                  <ImportSessionButton
                    phaseId={phase.id}
                    todayExercises={session.exercises.map((e) => ({ id: e.id, name: e.name }))}
                  />
                )}
              </div>
            </TerminalPanel>
            <TrainWeekDots scheduled={weekScheduled} logged={weekLogged} />
          </div>
          <TerminalPanel fill={false} className="md:hidden">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-body font-semibold text-[var(--rtd-text)]">{session.title}</div>
                <div className="text-footnote text-[var(--rtd-text-tertiary)] mt-1">
                  {session.exercises.length} exercise{session.exercises.length === 1 ? "" : "s"}
                </div>
              </div>
              {selectedDay === todayDayKey() && (
                <ImportSessionButton
                  phaseId={phase.id}
                  todayExercises={session.exercises.map((e) => ({ id: e.id, name: e.name }))}
                  compact
                />
              )}
            </div>
          </TerminalPanel>
          <WorkoutSession phaseId={phase.id} sessionTitle={session.title} exercises={exerciseData} weightUnit={weightUnit} />
        </>
      ) : (
        <EmptyState title="No session for this day" body="Pick another day above." />
      )}
    </div>
  );
}
