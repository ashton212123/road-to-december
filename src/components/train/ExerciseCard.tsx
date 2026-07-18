"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { IconBolt, IconCheck, IconChevronDown } from "@/components/ui/icons";
import {
  logSetAction,
  deleteSetAction,
  updateSetAction,
  completeExerciseAction,
  uncompleteExerciseAction,
} from "@/app/(app)/train/actions";
import type { ProgressionSuggestion } from "@/lib/train/progression";

type LoggedSet = {
  id: number;
  setNumber: number;
  weightKg: string | null;
  reps: number | null;
  rpe: string | null;
  restSeconds: number | null;
  notes: string | null;
};

type PastSet = { weightKg: string | null; reps: number | null; rpe: string | null };

export function ExerciseCard({
  exercise,
  phaseId,
  lastSessionSets,
  todaysSets,
  progression,
}: {
  exercise: {
    id: number;
    name: string;
    prescription: string;
    targetSets: number | null;
    targetRepsMin: number | null;
    targetRepsMax: number | null;
    restSecondsPrescribed: number | null;
    isExplosive: boolean;
    isMainLift: boolean;
  };
  phaseId: string;
  lastSessionSets: PastSet[];
  todaysSets: LoggedSet[];
  progression: ProgressionSuggestion | null;
}) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [restElapsed, setRestElapsed] = useState<number | null>(null);
  const lastLogAt = useRef<number | null>(null);

  const completed = todaysSets.length > 0;

  useEffect(() => {
    if (restElapsed === null) return;
    const interval = setInterval(() => {
      if (lastLogAt.current) {
        setRestElapsed(Math.floor((Date.now() - lastLogAt.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [restElapsed]);

  function toggleCompleted() {
    if (completed) {
      startTransition(() => uncompleteExerciseAction(exercise.id, phaseId));
      return;
    }
    const lastTopWeight = lastSessionSets.reduce<number | null>((best, s) => {
      const w = s.weightKg ? Number(s.weightKg) : null;
      if (w === null) return best;
      return best === null || w > best ? w : best;
    }, null);
    startTransition(() =>
      completeExerciseAction({
        exerciseId: exercise.id,
        phaseId,
        setCount: exercise.targetSets ?? 1,
        defaultReps: exercise.targetRepsMax ?? exercise.targetRepsMin ?? null,
        defaultWeightKg: lastTopWeight,
      })
    );
  }

  function handleAddSet() {
    const restSeconds = lastLogAt.current ? Math.floor((Date.now() - lastLogAt.current) / 1000) : null;
    const setNumber = todaysSets.length + 1;
    startTransition(async () => {
      await logSetAction({
        exerciseId: exercise.id,
        setNumber,
        weightKg: weight ? Number(weight) : null,
        reps: reps ? Number(reps) : null,
        rpe: rpe ? Number(rpe) : null,
        restSeconds,
        phaseId,
      });
      lastLogAt.current = Date.now();
      setRestElapsed(0);
      setWeight("");
      setReps("");
      setRpe("");
    });
  }

  const restPrescribed = exercise.restSecondsPrescribed;
  const restCompare =
    restElapsed !== null && restPrescribed
      ? restElapsed < restPrescribed
        ? "under"
        : restElapsed > restPrescribed * 1.3
          ? "over"
          : "on-target"
      : null;

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={toggleCompleted}
          disabled={pending}
          aria-label={completed ? "Mark not completed" : "Mark completed"}
          aria-pressed={completed}
          className="rtd-tap-target shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90 cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
          style={{
            background: completed ? "var(--rtd-green)" : "rgba(255,255,255,0.08)",
            border: completed ? "none" : "1.5px solid rgba(255,255,255,0.25)",
            color: "#fff",
          }}
        >
          {completed && <IconCheck size={15} />}
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
            {exercise.isMainLift && (
              <span className="text-caption font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--rtd-blue)]/20 text-[var(--rtd-blue)] shrink-0">
                Main
              </span>
            )}
          </div>
          <div className="text-footnote text-[var(--rtd-text-secondary)]">{exercise.prescription || "—"}</div>
        </button>

        <span
          className="shrink-0 mt-1 text-[var(--rtd-text-tertiary)] transition-transform"
          style={{ transform: expanded ? "rotate(180deg)" : "none" }}
        >
          <IconChevronDown />
        </span>
      </div>

      {progression && (
        <div className="rounded-xl bg-[var(--rtd-green)]/10 border border-[var(--rtd-green)]/20 px-3 py-2">
          <div className="text-subhead font-semibold text-[var(--rtd-green)]">{progression.headline}</div>
          <div className="text-footnote text-[var(--rtd-text-tertiary)] mt-0.5">{progression.rationale}</div>
        </div>
      )}

      {!expanded && lastSessionSets.length > 0 && (
        <div className="text-footnote text-[var(--rtd-text-secondary)]">
          Last session: {lastSessionSets.map((s) => `${s.weightKg ?? "–"}×${s.reps ?? "–"}@${s.rpe ?? "–"}`).join("  ·  ")}
        </div>
      )}

      {completed && !expanded && (
        <div className="text-footnote text-[var(--rtd-green)]">
          {todaysSets.length} set{todaysSets.length === 1 ? "" : "s"} logged — tap to edit details
        </div>
      )}

      {expanded && (
        <div className="flex flex-col gap-3 rtd-fade-in">
          {lastSessionSets.length > 0 && (
            <div className="text-footnote text-[var(--rtd-text-secondary)]">
              Last session: {lastSessionSets.map((s) => `${s.weightKg ?? "–"}×${s.reps ?? "–"}@${s.rpe ?? "–"}`).join("  ·  ")}
            </div>
          )}

          {todaysSets.length > 0 && (
            <div className="flex flex-col gap-1">
              {todaysSets.map((s) => (
                <SetRow key={s.id} set={s} phaseId={phaseId} />
              ))}
            </div>
          )}

          {restElapsed !== null && (
            <div
              className="text-center text-footnote rounded-xl py-2"
              style={{
                background:
                  restCompare === "under"
                    ? "rgba(255,159,10,0.12)"
                    : restCompare === "over"
                      ? "rgba(255,69,58,0.12)"
                      : "rgba(48,209,88,0.12)",
                color:
                  restCompare === "under"
                    ? "var(--rtd-orange)"
                    : restCompare === "over"
                      ? "var(--rtd-red)"
                      : "var(--rtd-green)",
              }}
            >
              Rest: {Math.floor(restElapsed / 60)}:{String(restElapsed % 60).padStart(2, "0")}
              {restPrescribed && <span className="opacity-70"> / target {Math.round(restPrescribed / 60)}min</span>}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 items-end">
            <label className="flex flex-col gap-1 col-span-1">
              <span className="rtd-micro-label">kg</span>
              <input
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="rounded-lg bg-white/[0.06] px-2 py-2 text-sm text-center outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 col-span-1">
              <span className="rtd-micro-label">reps</span>
              <input
                inputMode="numeric"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
                className="rounded-lg bg-white/[0.06] px-2 py-2 text-sm text-center outline-none"
              />
            </label>
            <label className="flex flex-col gap-1 col-span-1">
              <span className="rtd-micro-label">rpe</span>
              <input
                inputMode="decimal"
                value={rpe}
                onChange={(e) => setRpe(e.target.value)}
                className="rounded-lg bg-white/[0.06] px-2 py-2 text-sm text-center outline-none"
              />
            </label>
            <Button type="button" variant="secondary" disabled={pending} onClick={handleAddSet} className="col-span-1 !px-2">
              Add set
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function SetRow({ set, phaseId }: { set: LoggedSet; phaseId: string }) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(set.weightKg ?? "");
  const [reps, setReps] = useState(set.reps !== null ? String(set.reps) : "");
  const [rpe, setRpe] = useState(set.rpe ?? "");
  const [notes, setNotes] = useState(set.notes ?? "");

  function save() {
    startTransition(async () => {
      await updateSetAction({
        logId: set.id,
        weightKg: weight ? Number(weight) : null,
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
        <div className="grid grid-cols-3 gap-2">
          <input
            inputMode="decimal"
            placeholder="kg"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-xs text-center outline-none"
          />
          <input
            inputMode="numeric"
            placeholder="reps"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-xs text-center outline-none"
          />
          <input
            inputMode="decimal"
            placeholder="rpe"
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-xs text-center outline-none"
          />
        </div>
        <input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-xs outline-none"
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
        className="flex-1 text-left rounded-md cursor-pointer hover:bg-white/[0.06] active:scale-[0.98] transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
      >
        <span className="text-[var(--rtd-text-secondary)]">Set {set.setNumber}</span>{" "}
        <span className="text-[var(--rtd-text)]">
          {set.weightKg ?? "–"}kg × {set.reps ?? "–"} @ RPE {set.rpe ?? "–"}
          {set.restSeconds !== null && <span className="text-[var(--rtd-text-secondary)]"> · rest {set.restSeconds}s</span>}
          {set.notes && <span className="text-[var(--rtd-text-secondary)]"> · {set.notes}</span>}
        </span>
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
