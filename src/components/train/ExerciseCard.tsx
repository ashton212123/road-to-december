"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { StatusChip } from "@/components/ui/StatusChip";
import { Button } from "@/components/ui/Button";
import { IconBolt, IconCheck, IconChevronDown } from "@/components/ui/icons";
import { logSetAction, deleteSetAction, updateSetAction } from "@/app/(app)/train/actions";
import type { ProgressionSuggestion } from "@/lib/train/progression";
import type { ActiveRest } from "./WorkoutSession";
import { kgToDisplay, displayToKg, type WeightUnit } from "@/lib/train/units";
import { classifyTransfer } from "@/lib/train/transfer";

/** Renders only the parts of a set that actually exist -- a checkbox-completed
 * bodyweight exercise (no weight) used to read "–kg × 6 @ RPE –", which looks
 * broken rather than intentional. */
function formatSetParts(weightDisplay: number | null, reps: number | null, rpe: string | null, unit: WeightUnit): string {
  const parts: string[] = [];
  if (weightDisplay !== null) parts.push(`${weightDisplay}${unit} × ${reps ?? "–"}`);
  else if (reps !== null) parts.push(`${reps} reps`);
  if (rpe !== null) parts.push(`RPE ${rpe}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function formatPastSet(s: PastSet, unit: WeightUnit): string {
  const weightKg = s.weightKg !== null ? Number(s.weightKg) : null;
  const weightDisplay = weightKg !== null ? kgToDisplay(weightKg, unit) : null;
  return formatSetParts(weightDisplay, s.reps, s.rpe, unit);
}

export type LoggedSet = {
  id: number;
  setNumber: number;
  weightKg: string | null;
  reps: number | null;
  rpe: string | null;
  restSeconds: number | null;
  notes: string | null;
};

export type PastSet = { weightKg: string | null; reps: number | null; rpe: string | null };

export type ExerciseSummary = {
  id: number;
  name: string;
  prescription: string;
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  restSecondsPrescribed: number | null;
  isExplosive: boolean;
  isMainLift: boolean;
  movementPattern: string | null;
};

export function ExerciseCard({
  exercise,
  phaseId,
  lastSessionSets,
  todaysSets,
  progression,
  resolvedDefaultWeightKg,
  completed,
  onToggleCompleted,
  togglePending,
  activeRest,
  now,
  onRestStarted,
  onExerciseFinished,
  weightUnit,
}: {
  exercise: ExerciseSummary;
  phaseId: string;
  lastSessionSets: PastSet[];
  todaysSets: LoggedSet[];
  progression: ProgressionSuggestion | null;
  /** Same fallback chain (stored default -> progression -> last session's
   * top weight) the checkbox-complete flow already uses -- the "Add set"
   * row's ghost weight, so both entry points suggest the same number. */
  resolvedDefaultWeightKg: number | null;
  /** Owned by the parent WorkoutSession so it can detect "all done" and show the completion summary. */
  completed: boolean;
  onToggleCompleted: () => void;
  togglePending: boolean;
  /** Rest timer state is owned by WorkoutSession (one shared timer, one
   * sticky RestPill) instead of per-card -- these three come straight from
   * the parent's single tick interval. */
  activeRest: ActiveRest | null;
  now: number | null;
  onRestStarted: (startedAt: number) => void;
  /** Fires instead of onRestStarted when the set just logged was the last
   * prescribed one -- the rest timer has nothing left to count down to, so
   * it must not start (G11: "the rest timer keeps counting after my last set"). */
  onExerciseFinished: () => void;
  /** Storage is always kg (DB, actions, e1RM, tonnage never change) --
   * display and input convert at this component's edge only. */
  weightUnit: WeightUnit;
}) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  // One-shot pop the instant this card crosses into complete -- never on
  // mount (the ref starts at the current value, so an already-done exercise
  // never sees a false->true transition) and never on uncomplete/undo.
  const wasCompletedRef = useRef(completed);
  const [justCompleted, setJustCompleted] = useState(false);
  useEffect(() => {
    if (!wasCompletedRef.current && completed) {
      setJustCompleted(true);
      const t = setTimeout(() => setJustCompleted(false), 300);
      wasCompletedRef.current = completed;
      return () => clearTimeout(t);
    }
    wasCompletedRef.current = completed;
  }, [completed]);

  const transfer = classifyTransfer(exercise.name, exercise.movementPattern, exercise.isExplosive);

  const isActiveRestHere = activeRest?.exerciseId === exercise.id;
  const elapsed = isActiveRestHere && now !== null ? Math.floor((now - (activeRest?.startedAt ?? 0)) / 1000) : null;

  // Ghost defaults (Hevy pattern, V4 P5): every field arrives pre-filled as
  // placeholder text so nothing in the workout flow ever starts genuinely
  // blank. Confirming an untouched field logs the ghost value; typing
  // overrides it. Weight: prescribed -> progression -> last session's top
  // weight (same chain checkbox-complete uses), converted to the athlete's
  // display unit. Reps: prescribed range, falling back to last session's
  // last set. RPE: last session's last set only -- there's no "prescribed
  // RPE" concept here.
  const lastSet = lastSessionSets[lastSessionSets.length - 1];
  const lastSetWeightKg = lastSet?.weightKg !== null && lastSet?.weightKg !== undefined ? Number(lastSet.weightKg) : null;
  const ghostWeightKg = resolvedDefaultWeightKg ?? lastSetWeightKg;
  const ghostWeight = ghostWeightKg !== null ? String(kgToDisplay(ghostWeightKg, weightUnit)) : "";
  const ghostReps = String(exercise.targetRepsMax ?? exercise.targetRepsMin ?? lastSet?.reps ?? "");

  const targetSets = exercise.targetSets;
  const isFinalPrescribedSet = targetSets !== null && todaysSets.length + 1 >= targetSets;
  const isPastTarget = targetSets !== null && todaysSets.length >= targetSets;

  function handleAddSet() {
    const restSeconds = isActiveRestHere ? Math.floor((Date.now() - (activeRest?.startedAt ?? 0)) / 1000) : null;
    const setNumber = todaysSets.length + 1;
    const startedAt = Date.now();
    const finishedNow = isFinalPrescribedSet;
    navigator.vibrate?.(50);
    startTransition(async () => {
      const usedWeightDisplay = weight ? Number(weight) : ghostWeight ? Number(ghostWeight) : null;
      const usedWeight = usedWeightDisplay !== null ? displayToKg(usedWeightDisplay, weightUnit) : null;
      const usedReps = reps ? Number(reps) : ghostReps ? Number(ghostReps) : null;
      await logSetAction({
        exerciseId: exercise.id,
        setNumber,
        weightKg: usedWeight,
        reps: usedReps,
        rpe: null,
        restSeconds,
        phaseId,
      });
      // Only start a rest timer when there's a next set to rest FOR -- on the
      // last prescribed set, counting down to nothing is the bug the athlete
      // reported ("keeps counting after my last set").
      if (finishedNow) onExerciseFinished();
      else onRestStarted(startedAt);
      setWeight("");
      setReps("");
    });
  }

  const restPrescribed = exercise.restSecondsPrescribed;
  const remaining = elapsed !== null && restPrescribed ? restPrescribed - elapsed : null;
  const isOver = remaining !== null && remaining <= 0;
  // Countdown coloring: green while still counting down; once it flips past
  // zero, orange (mild) then red (past 1.3x target) -- not the old count-up
  // scheme where orange meant "still resting."
  const restSeverity: "on-target" | "over-mild" | "over-hard" | null =
    elapsed === null ? null : !restPrescribed ? "on-target" : !isOver ? "on-target" : elapsed > restPrescribed * 1.3 ? "over-hard" : "over-mild";

  return (
    <TerminalPanel fill={false}>
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggleCompleted}
          disabled={togglePending}
          aria-label={completed ? "Mark not completed" : "Mark completed"}
          aria-pressed={completed}
          className="rtd-tap-target shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
          style={{
            background: completed ? "var(--rtd-green)" : "rgba(255,255,255,0.08)",
            border: completed ? "none" : "1.5px solid rgba(255,255,255,0.25)",
            color: "#fff",
            transition: "background-color 150ms ease-out, transform 150ms ease-out",
          }}
        >
          {completed && (
            <span className={justCompleted ? "rtd-check-pop" : undefined}>
              <IconCheck size={15} />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left rounded-lg cursor-pointer hover:bg-white/[0.04] active:scale-[0.98] transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-body font-semibold truncate">{exercise.name}</span>
            {exercise.isExplosive && (
              <span className="text-[var(--rtd-orange)] shrink-0" title="Explosive intent">
                <IconBolt />
              </span>
            )}
            {exercise.isMainLift && <StatusChip label="Main" tone="live" />}
          </div>
          <div className="text-footnote text-[var(--rtd-text-secondary)]">{exercise.prescription || "—"}</div>
          <div className="text-caption text-[var(--rtd-text-tertiary)] mt-0.5">{transfer.why}</div>
        </button>

        <span
          className="shrink-0 mt-1 text-[var(--rtd-text-tertiary)] transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
        >
          <IconChevronDown />
        </span>
      </div>

      {progression && (
        <div className="rounded-[10px] bg-[var(--rtd-green)]/10 border border-[var(--rtd-green)]/20 px-3 py-2">
          <div className="text-subhead font-semibold text-[var(--rtd-green)]">{progression.headline}</div>
          <div className="text-footnote text-[var(--rtd-text-tertiary)] mt-0.5">{progression.rationale}</div>
        </div>
      )}

      {!expanded && lastSessionSets.length > 0 && (
        <div className="text-footnote text-[var(--rtd-text-secondary)]">
          Last session: <span className="rtd-mono">{lastSessionSets.map((s) => formatPastSet(s, weightUnit)).join("  ·  ")}</span>
        </div>
      )}

      {completed && !expanded && (
        <div className="text-footnote text-[var(--rtd-green)]">
          {todaysSets.length > 0 ? `${todaysSets.length} set${todaysSets.length === 1 ? "" : "s"} logged` : "Done"} — tap to edit details
        </div>
      )}

      {/* Partial progress must never read as a plain unchecked box -- an
          in-progress exercise shows exactly how many of the prescribed sets
          are done so it's obvious why the checkbox isn't filled yet. */}
      {!completed && !expanded && targetSets !== null && todaysSets.length > 0 && (
        <div className="text-footnote text-[var(--rtd-text-secondary)]">
          <span className="rtd-mono">
            {todaysSets.length}/{targetSets}
          </span>{" "}
          sets — tap to continue
        </div>
      )}

      {expanded && (
        <div className="flex flex-col gap-3 rtd-fade-in">
          {lastSessionSets.length > 0 && (
            <div className="text-footnote text-[var(--rtd-text-secondary)]">
              Last session: <span className="rtd-mono">{lastSessionSets.map((s) => formatPastSet(s, weightUnit)).join("  ·  ")}</span>
            </div>
          )}

          {todaysSets.length > 0 && (
            <div className="flex flex-col gap-1">
              {todaysSets.map((s) => (
                <SetRow key={s.id} set={s} phaseId={phaseId} weightUnit={weightUnit} />
              ))}
            </div>
          )}

          {elapsed !== null && (
            <div
              className="text-center text-footnote rtd-mono rounded-[8px] py-2"
              style={{
                background:
                  restSeverity === "over-mild"
                    ? "rgba(255,159,10,0.12)"
                    : restSeverity === "over-hard"
                      ? "rgba(255,69,58,0.12)"
                      : "rgba(48,209,88,0.12)",
                color:
                  restSeverity === "over-mild"
                    ? "var(--rtd-orange)"
                    : restSeverity === "over-hard"
                      ? "var(--rtd-red)"
                      : "var(--rtd-green)",
              }}
            >
              {restPrescribed ? (
                !isOver ? (
                  <>Rest: {Math.floor((remaining ?? 0) / 60)}:{String((remaining ?? 0) % 60).padStart(2, "0")} left</>
                ) : (
                  <>
                    Rest: +{Math.floor(Math.abs(remaining ?? 0) / 60)}:{String(Math.abs(remaining ?? 0) % 60).padStart(2, "0")} over
                  </>
                )
              ) : (
                <>Rest: {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</>
              )}
            </div>
          )}

          <div className="grid gap-2 items-end grid-cols-3">
            <label className="flex flex-col gap-1 col-span-1">
              <span className="rtd-micro-label">{weightUnit}</span>
              <input
                inputMode="decimal"
                value={weight}
                placeholder={ghostWeight || "optional"}
                onChange={(e) => setWeight(e.target.value)}
                className="rounded-lg bg-white/[0.06] px-2 py-2 text-subhead text-center outline-none placeholder:text-[var(--rtd-text-tertiary)]"
              />
            </label>
            <label className="flex flex-col gap-1 col-span-1">
              <span className="rtd-micro-label">reps</span>
              <input
                inputMode="numeric"
                value={reps}
                placeholder={ghostReps || undefined}
                onChange={(e) => setReps(e.target.value)}
                className="rounded-lg bg-white/[0.06] px-2 py-2 text-subhead text-center outline-none placeholder:text-[var(--rtd-text-tertiary)]"
              />
            </label>
            <Button type="button" variant="secondary" disabled={pending} onClick={handleAddSet} className="col-span-1 !px-2">
              {isPastTarget ? "Add extra set" : "Add set"}
            </Button>
          </div>
          {ghostReps && !reps && (
            <div className="text-caption text-[var(--rtd-text-tertiary)] -mt-1">
              Logs <span className="rtd-mono">{ghostReps}</span> reps unless you change it.
            </div>
          )}
          {targetSets !== null && (
            <div className="text-caption text-[var(--rtd-text-tertiary)] -mt-1">
              <span className="rtd-mono">
                {Math.min(todaysSets.length, targetSets)}/{targetSets}
              </span>{" "}
              prescribed sets done
            </div>
          )}
        </div>
      )}
    </TerminalPanel>
  );
}

function SetRow({ set, phaseId, weightUnit }: { set: LoggedSet; phaseId: string; weightUnit: WeightUnit }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const initialWeightKg = set.weightKg !== null ? Number(set.weightKg) : null;
  const [weight, setWeight] = useState(initialWeightKg !== null ? String(kgToDisplay(initialWeightKg, weightUnit)) : "");
  const [reps, setReps] = useState(set.reps !== null ? String(set.reps) : "");
  const [rpe, setRpe] = useState(set.rpe ?? "");
  const [notes, setNotes] = useState(set.notes ?? "");

  function save() {
    startTransition(async () => {
      await updateSetAction({
        logId: set.id,
        weightKg: weight ? displayToKg(Number(weight), weightUnit) : null,
        reps: reps ? Number(reps) : null,
        rpe: rpe ? Number(rpe) : null,
        notes: notes || null,
        phaseId,
      });
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 bg-white/[0.04] rounded-lg px-2.5 py-2">
        <div className="grid gap-2 grid-cols-3">
          <input
            inputMode="decimal"
            placeholder={weightUnit}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-subhead text-center outline-none"
          />
          <input
            inputMode="numeric"
            placeholder="reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-subhead text-center outline-none"
          />
          <input
            inputMode="decimal"
            placeholder="rpe"
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-subhead text-center outline-none"
          />
        </div>
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-subhead outline-none"
        />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" disabled={pending} onClick={save} className="flex-1 !py-1.5">
            Save
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={() => setEditing(false)} className="flex-1 !py-1.5">
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between text-footnote bg-white/[0.04] rounded-lg px-2.5 py-1.5">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rtd-tap-target flex-1 text-left rounded-md cursor-pointer hover:bg-white/[0.06] active:scale-[0.98] transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
      >
        <span className="text-[var(--rtd-text-secondary)] rtd-mono">Set {set.setNumber}</span>{" "}
        <span className="text-[var(--rtd-text)] rtd-mono">
          {formatSetParts(initialWeightKg !== null ? kgToDisplay(initialWeightKg, weightUnit) : null, set.reps, set.rpe, weightUnit)}
          {set.restSeconds !== null && <span className="text-[var(--rtd-text-secondary)]"> · rest {set.restSeconds}s</span>}
        </span>
        {set.notes && <span className="text-[var(--rtd-text-secondary)]"> · {set.notes}</span>}
      </button>
      <button
        type="button"
        onClick={() => startTransition(() => deleteSetAction(set.id, phaseId))}
        className="rtd-tap-target text-[var(--rtd-red)] ml-2 rounded-full cursor-pointer hover:bg-white/[0.06] active:scale-[0.98] transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
        aria-label="Delete set"
      >
        ✕
      </button>
    </div>
  );
}
