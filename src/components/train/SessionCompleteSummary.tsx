"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

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
        <Button variant="secondary" onClick={onDismiss} className="mt-3 w-full">
          Done
        </Button>
      </GlassCard>
    </div>
  );
}
