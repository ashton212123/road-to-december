"use client";

import { useTransition } from "react";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { logWaterAction } from "@/app/(app)/fuel/actions";

export function WaterLogger({ ml, targetMl }: { ml: number; targetMl: number }) {
  const [pending, startTransition] = useTransition();
  const amounts = [250, 500, 750];

  return (
    <div className="flex items-center gap-4">
      <ProgressRing pct={(ml / targetMl) * 100} size={64} strokeWidth={7} color="var(--rtd-cyan)" />
      <div className="flex-1">
        <div className="text-sm font-semibold">
          {(ml / 1000).toFixed(2)}L <span className="text-[var(--rtd-text-tertiary)] font-normal">/ {(targetMl / 1000).toFixed(1)}L</span>
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {amounts.map((amt) => (
            <button
              key={amt}
              disabled={pending}
              onClick={() => startTransition(() => logWaterAction(amt))}
              className="text-[10px] px-2.5 py-1.5 rounded-full bg-[var(--rtd-cyan)]/15 text-[var(--rtd-cyan)] disabled:opacity-40"
            >
              +{amt}ml
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
