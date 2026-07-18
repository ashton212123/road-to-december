"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { logSorenessAction } from "@/app/(app)/more/actions";

const RATINGS = [1, 2, 3, 4, 5];

export function SorenessLogger() {
  const [rating, setRating] = useState<number | null>(null);
  const [area, setArea] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function submit() {
    if (!rating || !area) return;
    startTransition(async () => {
      await logSorenessAction(rating, area);
      setDone(true);
      setArea("");
      setRating(null);
    });
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="text-body font-semibold">Soreness</div>
      <div className="flex gap-2 justify-between">
        {RATINGS.map((r) => (
          <button
            key={r}
            onClick={() => setRating(r)}
            className="rtd-tap-target flex-1 py-2 rounded-lg text-subhead font-semibold cursor-pointer transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
            style={{
              background: rating === r ? "var(--rtd-orange)" : "rgba(255,255,255,0.06)",
              color: rating === r ? "#fff" : "var(--rtd-text-secondary)",
            }}
          >
            {r}
          </button>
        ))}
      </div>
      <input
        placeholder="Area (e.g. shins, shoulders)"
        value={area}
        onChange={(e) => setArea(e.target.value)}
        className="rounded-lg bg-white/[0.06] px-3 py-2 text-xs outline-none"
      />
      <Button variant="secondary" onClick={submit} disabled={pending || !rating || !area}>
        {done ? "Logged ✓" : "Log soreness"}
      </Button>
    </GlassCard>
  );
}
