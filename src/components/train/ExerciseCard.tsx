"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { IconBolt } from "@/components/ui/icons";
import { logSetAction, deleteSetAction } from "@/app/(app)/train/actions";
import type { ProgressionSuggestion } from "@/lib/train/progression";

type LoggedSet = {
  id: number;
  setNumber: number;
  weightKg: string | null;
  reps: number | null;
  rpe: string | null;
  restSeconds: number | null;
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
    restSecondsPrescribed: number | null;
    isExplosive: boolean;
    isMainLift: boolean;
  };
  phaseId: string;
  lastSessionSets: PastSet[];
  todaysSets: LoggedSet[];
  progression: ProgressionSuggestion | null;
}) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [pending, startTransition] = useTransition();
  const [restElapsed, setRestElapsed] = useState<number | null>(null);
  const lastLogAt = useRef<number | null>(null);

  useEffect(() => {
    if (restElapsed === null) return;
    const interval = setInterval(() => {
      if (lastLogAt.current) {
        setRestElapsed(Math.floor((Date.now() - lastLogAt.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [restElapsed]);

  function handleLog() {
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
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{exercise.name}</span>
            {exercise.isExplosive && (
              <span className="text-[var(--rtd-orange)] shrink-0" title="Explosive intent">
                <IconBolt />
              </span>
            )}
            {exercise.isMainLift && (
              <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--rtd-blue)]/20 text-[var(--rtd-blue)] shrink-0">
                Main
              </span>
            )}
          </div>
          <div className="text-xs text-[var(--rtd-text-secondary)]">{exercise.prescription || "—"}</div>
        </div>
      </div>

      {progression && (
        <div className="rounded-xl bg-[var(--rtd-green)]/10 border border-[var(--rtd-green)]/20 px-3 py-2">
          <div className="text-xs font-semibold text-[var(--rtd-green)]">{progression.headline}</div>
          <div className="text-[10px] text-[var(--rtd-text-tertiary)] mt-0.5">{progression.rationale}</div>
        </div>
      )}

      {lastSessionSets.length > 0 && (
        <div className="text-[10px] text-[var(--rtd-text-tertiary)]">
          Last session: {lastSessionSets.map((s) => `${s.weightKg ?? "–"}×${s.reps ?? "–"}@${s.rpe ?? "–"}`).join("  ·  ")}
        </div>
      )}

      {todaysSets.length > 0 && (
        <div className="flex flex-col gap-1">
          {todaysSets.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between text-xs bg-white/[0.04] rounded-lg px-2.5 py-1.5"
            >
              <span className="text-[var(--rtd-text-tertiary)]">Set {s.setNumber}</span>
              <span className="text-[var(--rtd-text)]">
                {s.weightKg ?? "–"}kg × {s.reps ?? "–"} @ RPE {s.rpe ?? "–"}
                {s.restSeconds !== null && (
                  <span className="text-[var(--rtd-text-tertiary)]"> · rest {s.restSeconds}s</span>
                )}
              </span>
              <button
                onClick={() => startTransition(() => deleteSetAction(s.id, phaseId))}
                className="text-[var(--rtd-red)] ml-2"
                aria-label="Delete set"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {restElapsed !== null && (
        <div
          className="text-center text-xs rounded-xl py-2"
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
          <span className="rtd-micro-label !text-[9px]">kg</span>
          <input
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-2 py-2 text-sm text-center outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 col-span-1">
          <span className="rtd-micro-label !text-[9px]">reps</span>
          <input
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-2 py-2 text-sm text-center outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 col-span-1">
          <span className="rtd-micro-label !text-[9px]">rpe</span>
          <input
            inputMode="decimal"
            value={rpe}
            onChange={(e) => setRpe(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-2 py-2 text-sm text-center outline-none"
          />
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          onClick={handleLog}
          className="col-span-1 !px-2"
        >
          Log
        </Button>
      </div>
    </GlassCard>
  );
}
