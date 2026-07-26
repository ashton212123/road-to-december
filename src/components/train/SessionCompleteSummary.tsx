"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { logSessionRpeAction } from "@/app/(app)/train/actions";

const RPE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function SessionCompleteSummary({
  sessionTitle,
  exerciseCount,
  durationMin,
  onDismiss,
}: {
  sessionTitle: string;
  exerciseCount: number;
  durationMin: number;
  onDismiss: () => void;
}) {
  const [rpe, setRpe] = useState<number | null>(null);
  const [rated, setRated] = useState(false);
  const [pending, startTransition] = useTransition();

  function rate(value: number) {
    setRpe(value);
    startTransition(async () => {
      await logSessionRpeAction({ kind: "gym", rpe: value, durationMin });
      setRated(true);
    });
  }

  return (
    <div
      className="rtd-glass-blur fixed inset-0 z-40 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Session complete"
    >
      <GlassCard
        className="rtd-glass-blur rtd-session-complete rtd-hero-glow flex flex-col items-center gap-3 text-center max-w-sm w-full py-8"
        style={{ backgroundColor: "rgba(28,28,30,0.72)" }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-title-1"
          style={{ background: "rgba(48,209,88,0.15)" }}
        >
          <span aria-hidden="true">✓</span>
        </div>
        <div className="text-title-2 font-semibold">Session complete</div>
        <div className="text-subhead text-[var(--rtd-text-secondary)]">{sessionTitle}</div>
        <div className="flex gap-6 mt-2">
          <div className="flex flex-col items-center">
            <span className="text-title-1 rtd-display">{exerciseCount}</span>
            <span className="rtd-micro-label">exercises</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-title-1 rtd-display">{durationMin}</span>
            <span className="rtd-micro-label">minutes</span>
          </div>
        </div>

        {!rated ? (
          <div className="flex flex-col items-center gap-1.5 w-full mt-1">
            <span className="text-caption text-[var(--rtd-text-secondary)]">How hard was that session, overall?</span>
            <span className="text-caption text-[var(--rtd-text-tertiary)]">
              Rate about 30 minutes after finishing — that&apos;s the window session-RPE was designed for [moderate].
            </span>
            <div className="grid grid-cols-5 gap-1.5 w-full">
              {RPE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={pending}
                  onClick={() => rate(r)}
                  className="rtd-tap-target py-2 rounded-lg text-subhead font-semibold cursor-pointer"
                  style={{
                    background: rpe === r ? "rgba(90,200,250,0.18)" : "rgba(255,255,255,0.06)",
                    border: rpe === r ? "1px solid var(--rtd-cyan)" : "1px solid transparent",
                    color: rpe === r ? "var(--rtd-cyan)" : "var(--rtd-text-secondary)",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-caption text-[var(--rtd-green)]">Session load logged ✓</div>
        )}

        <Button variant="secondary" onClick={onDismiss} className="mt-3 w-full">
          Done
        </Button>
      </GlassCard>
    </div>
  );
}
