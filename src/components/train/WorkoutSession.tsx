"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ExerciseCard, type ExerciseSummary, type LoggedSet, type PastSet } from "./ExerciseCard";
import { RestPill } from "./RestPill";
import { SessionCompleteSummary } from "./SessionCompleteSummary";
import { completeExerciseAction, uncompleteExerciseAction } from "@/app/(app)/train/actions";
import type { ProgressionSuggestion } from "@/lib/train/progression";

export type SessionExerciseEntry = {
  exercise: ExerciseSummary;
  lastSessionSets: PastSet[];
  todaysSets: LoggedSet[];
  progression: ProgressionSuggestion | null;
  resolvedDefaultWeightKg: number | null;
};

export type ActiveRest = { exerciseId: number; exerciseName: string; startedAt: number; targetSec: number | null };

// 5 minutes past a prescribed target with no new set logged -- the athlete
// moved on without tapping the pill away; stop nagging.
const AUTO_DISMISS_PAST_TARGET_SEC = 300;

/** Owns completion state for the whole session (not per-card) so it can tell
 * the moment every exercise flips to done and show the completion summary. */
export function WorkoutSession({
  phaseId,
  sessionTitle,
  exercises,
  weightUnit,
}: {
  phaseId: string;
  sessionTitle: string;
  exercises: SessionExerciseEntry[];
  weightUnit: "kg" | "lb";
}) {
  const initialCompleted = new Map(exercises.map((e) => [e.exercise.id, e.todaysSets.length > 0]));
  const [optimisticCompleted, setOptimisticCompleted] = useOptimistic(
    initialCompleted,
    (state, update: { id: number; value: boolean }) => {
      const next = new Map(state);
      next.set(update.id, update.value);
      return next;
    }
  );
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [durationMin, setDurationMin] = useState(1);
  const startedAtRef = useRef<number | null>(null);
  const [activeRest, setActiveRest] = useState<ActiveRest | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

  // One tick interval for the whole session (not one per card) -- only runs
  // while a rest is actually active. Both setState calls happen inside the
  // interval callback (an external-timer subscription), never synchronously
  // in the effect body, and auto-dismisses well past target so a forgotten
  // pill doesn't nag indefinitely.
  useEffect(() => {
    if (!activeRest) return;
    const interval = setInterval(() => {
      const nowTs = Date.now();
      setNow(nowTs);
      // Exercises with no prescribed rest used to never auto-dismiss at all
      // (the guard required a truthy targetSec) -- default to a 3-minute
      // ceiling so an unprescribed rest still clears itself eventually.
      const target = activeRest.targetSec ?? 180;
      if (Math.floor((nowTs - activeRest.startedAt) / 1000) > target + AUTO_DISMISS_PAST_TARGET_SEC) {
        setActiveRest(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeRest]);

  // startedAt is computed by the caller (ExerciseCard's own event handler,
  // where Date.now() is already established as safe) rather than here --
  // this function isn't wired as a direct JSX handler, so a Date.now() call
  // in its own body reads as a possible impure-during-render call to the
  // compiler's purity check.
  function handleRestStarted(entry: SessionExerciseEntry, startedAt: number) {
    setActiveRest({
      exerciseId: entry.exercise.id,
      exerciseName: entry.exercise.name,
      startedAt,
      targetSec: entry.exercise.restSecondsPrescribed,
    });
    setNow(startedAt);
  }

  // The last prescribed set of an exercise has nothing left to rest for --
  // clear any running timer instead of starting one. The set itself was
  // already logged for real via logSetAction (unlike the checkbox path,
  // which bulk-inserts default sets), so completion here is just flipping
  // the optimistic flag -- never completeExerciseAction, which would insert
  // a second, duplicate round of sets on top of what was just logged.
  function handleExerciseFinished(entry: SessionExerciseEntry) {
    setActiveRest(null);
    const id = entry.exercise.id;
    if (optimisticCompleted.get(id)) return;
    const newCount = completedCount + 1;
    startTransition(() => {
      setOptimisticCompleted({ id, value: true });
      if (newCount === totalCount && totalCount > 0) {
        const started = startedAtRef.current ?? Date.now();
        setDurationMin(Math.max(1, Math.round((Date.now() - started) / 60000)));
        setShowSummary(true);
      }
    });
  }

  const totalCount = exercises.length;
  const completedCount = [...optimisticCompleted.values()].filter(Boolean).length;

  function handleToggle(entry: SessionExerciseEntry) {
    const id = entry.exercise.id;
    const wasCompleted = optimisticCompleted.get(id) ?? false;
    const willBeCompleted = !wasCompleted;
    const newCount = completedCount + (willBeCompleted ? 1 : -1);
    setPendingId(id);
    startTransition(async () => {
      setOptimisticCompleted({ id, value: willBeCompleted });
      try {
        if (wasCompleted) {
          await uncompleteExerciseAction(id, phaseId);
        } else {
          await completeExerciseAction({
            exerciseId: id,
            phaseId,
            setCount: entry.exercise.targetSets ?? 1,
            defaultReps: entry.exercise.targetRepsMax ?? entry.exercise.targetRepsMin ?? null,
            defaultWeightKg: entry.resolvedDefaultWeightKg,
          });
          if (newCount === totalCount && totalCount > 0) {
            const started = startedAtRef.current ?? Date.now();
            setDurationMin(Math.max(1, Math.round((Date.now() - started) / 60000)));
            setShowSummary(true);
          }
        }
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {totalCount > 0 && (
        <div className="flex items-center gap-2 text-caption text-[var(--rtd-text-tertiary)]">
          <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--rtd-green)] transition-[width] duration-500 ease-out"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
          <span className="shrink-0">
            {completedCount}/{totalCount}
          </span>
        </div>
      )}

      {exercises.map((entry) => (
        <ExerciseCard
          key={entry.exercise.id}
          exercise={entry.exercise}
          phaseId={phaseId}
          lastSessionSets={entry.lastSessionSets}
          todaysSets={entry.todaysSets}
          progression={entry.progression}
          resolvedDefaultWeightKg={entry.resolvedDefaultWeightKg}
          completed={optimisticCompleted.get(entry.exercise.id) ?? false}
          onToggleCompleted={() => handleToggle(entry)}
          togglePending={pendingId === entry.exercise.id}
          activeRest={activeRest}
          now={now}
          onRestStarted={(startedAt) => handleRestStarted(entry, startedAt)}
          onExerciseFinished={() => handleExerciseFinished(entry)}
          weightUnit={weightUnit}
        />
      ))}

      {showSummary && (
        <SessionCompleteSummary
          sessionTitle={sessionTitle}
          exerciseCount={totalCount}
          durationMin={durationMin}
          onDismiss={() => setShowSummary(false)}
        />
      )}

      <RestPill activeRest={activeRest} now={now} onDismiss={() => setActiveRest(null)} />
    </div>
  );
}
