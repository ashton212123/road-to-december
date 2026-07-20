"use client";

import { useState, useTransition } from "react";
import { updateTrainingStatusAction, type TrainingStatus } from "@/app/(app)/more/actions";

const STATUSES: { value: TrainingStatus; label: string; emoji: string }[] = [
  { value: "healthy", label: "Healthy", emoji: "💪" },
  { value: "sick", label: "Sick", emoji: "🤒" },
  { value: "injured", label: "Injured", emoji: "🩹" },
  { value: "break", label: "Break", emoji: "🌴" },
];

/** Gentler Streak-style status switch -- applies immediately on tap (no
 * separate save step), since it's a state you're *in*, not a preference
 * you're configuring. Used on the Settings page and, compact, from Home's
 * avatar menu. */
export function TrainingStatusControl({ current, compact = false }: { current: TrainingStatus; compact?: boolean }) {
  const [status, setStatus] = useState(current);
  const [, startTransition] = useTransition();

  function set(next: TrainingStatus) {
    setStatus(next);
    startTransition(async () => {
      await updateTrainingStatusAction(next);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {!compact && (
        <>
          <div className="text-body font-semibold">Training status</div>
          <div className="text-subhead text-[var(--rtd-text-secondary)]">
            While non-healthy, missed sessions are excused everywhere — week map, consistency %, readiness, and the
            coach brief all adjust tone accordingly. Zero pressure about what you can&apos;t control.
          </div>
        </>
      )}
      <div className="grid grid-cols-4 gap-1.5">
        {STATUSES.map((s) => {
          const active = status === s.value;
          return (
            <button
              key={s.value}
              type="button"
              aria-pressed={active}
              onClick={() => set(s.value)}
              className="flex flex-col items-center gap-1 rounded-[8px] py-2 cursor-pointer hover:brightness-110 active:scale-[0.98] transition-transform duration-150 ease-out"
              style={{
                background: active ? "rgba(10,132,255,0.14)" : "rgba(255,255,255,0.06)",
                color: active ? "var(--rtd-blue)" : "var(--rtd-text-secondary)",
              }}
            >
              <span aria-hidden="true">{s.emoji}</span>
              <span className="text-caption font-medium">{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
