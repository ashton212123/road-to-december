"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { ExerciseCard, type ExerciseSummary, type LoggedSet, type PastSet } from "./ExerciseCard";
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

/** Owns completion state for the whole session (not per-card) so it can tell
 * the moment every exercise flips to done and show the completion summary. */
export function WorkoutSession({
  phaseId,
  sessionTitle,
  exercises,
}: {
  phaseId: string;
  sessionTitle: string;
  exercises: SessionExerciseEntry[];
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

  useEffect(() => {
    startedAtRef.current = Date.now();
  }, []);

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
          completed={optimisticCompleted.get(entry.exercise.id) ?? false}
          onToggleCompleted={() => handleToggle(entry)}
          togglePending={pendingId === entry.exercise.id}
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
    </div>
  );
}
