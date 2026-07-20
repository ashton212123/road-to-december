"use client";

import { useTransition } from "react";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { logWaterAction } from "@/app/(app)/fuel/actions";

export function WaterLogger({
  ml,
  targetMl,
  readOnly = false,
}: {
  ml: number;
  targetMl: number;
  /** Viewing a past day — hides the quick-add buttons. */
  readOnly?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const amounts = [250, 500, 750];

  return (
    <div className="flex items-center gap-4">
      <ProgressRing
        pct={(ml / targetMl) * 100}
        size={64}
        strokeWidth={7}
        gradient={["var(--rtd-cyan)", "var(--rtd-blue)"]}
        glow
        ariaLabel={`Water: ${(ml / 1000).toFixed(2)} of ${(targetMl / 1000).toFixed(1)} liters`}
      />
      <div className="flex-1">
        <div className="text-body font-semibold">
          {(ml / 1000).toFixed(2)}L <span className="text-[var(--rtd-text-secondary)] font-normal">/ {(targetMl / 1000).toFixed(1)}L</span>
        </div>
        {!readOnly && (
          <div className="flex gap-1.5 mt-1.5">
            {amounts.map((amt) => (
              <button
                key={amt}
                disabled={pending}
                onClick={() => startTransition(() => logWaterAction(amt))}
                className="text-caption px-2.5 py-1.5 rounded-full bg-[var(--rtd-cyan)]/15 text-[var(--rtd-cyan)] disabled:opacity-40 cursor-pointer rtd-tap-target hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
              >
                +{amt}ml
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
