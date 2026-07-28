"use client";

import { useState, useTransition } from "react";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { logWaterAction } from "@/app/(app)/fuel/actions";

const MIN_ML = 1;
const MAX_ML = 5000;

/** "1" reads as liters (the way people actually say water amounts), "500"
 * reads as ml -- ambiguous only in the 1-10 range, which liters legitimately
 * live in and ml amounts never realistically do. */
function parseAmountToMl(raw: string): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  const ml = Math.round(value <= 10 ? value * 1000 : value);
  return Math.min(MAX_ML, Math.max(MIN_ML, ml));
}

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
  const [customAmount, setCustomAmount] = useState("");
  const amounts = [250, 500, 750];

  function logCustom() {
    const parsedMl = parseAmountToMl(customAmount);
    if (parsedMl === null) return;
    startTransition(() => logWaterAction(parsedMl));
    setCustomAmount("");
  }

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
        <div className="text-body font-semibold rtd-mono">
          {(ml / 1000).toFixed(2)}L <span className="text-[var(--rtd-text-secondary)] font-normal">/ {(targetMl / 1000).toFixed(1)}L</span>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {amounts.map((amt) => (
              <button
                key={amt}
                disabled={pending}
                onClick={() => startTransition(() => logWaterAction(amt))}
                className="text-caption px-2.5 py-1.5 rounded-full bg-[var(--rtd-cyan)]/15 text-[var(--rtd-cyan)] disabled:opacity-40 cursor-pointer rtd-tap-target hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out rtd-mono"
              >
                +{amt}ml
              </button>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                logCustom();
              }}
              className="flex items-center gap-1"
            >
              <input
                inputMode="decimal"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="L or ml"
                aria-label="Custom water amount"
                disabled={pending}
                className="w-20 rounded-full bg-white/[0.06] px-2.5 py-1.5 text-caption text-center outline-none placeholder:text-[var(--rtd-text-tertiary)] disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={pending || parseAmountToMl(customAmount) === null}
                className="text-caption px-2.5 py-1.5 rounded-full bg-[var(--rtd-cyan)]/15 text-[var(--rtd-cyan)] disabled:opacity-40 cursor-pointer rtd-tap-target hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
              >
                Add
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
