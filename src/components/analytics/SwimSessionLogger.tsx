"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { logSwimSessionAction } from "@/app/(app)/analytics/actions";

const LOADS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function SwimSessionLogger() {
  const [load, setLoad] = useState<number | null>(null);
  const [setsText, setSetsText] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function submit() {
    if (!load) return;
    startTransition(async () => {
      await logSwimSessionAction({ loadRating: load, setsText: setsText.trim() || null });
      setDone(true);
      setLoad(null);
      setSetsText("");
    });
  }

  return (
    <GlassCard className="flex flex-col gap-2.5">
      <div className="text-title-3">Log today&apos;s swim session</div>
      <div className="grid grid-cols-5 gap-1.5">
        {LOADS.map((l) => (
          <button
            key={l}
            onClick={() => {
              setLoad(l);
              setDone(false);
            }}
            className="rtd-tap-target py-2 rounded-lg text-subhead font-semibold cursor-pointer hover:bg-white/[0.06] active:scale-[0.98] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
            style={{
              background: load === l ? "rgba(90,200,250,0.18)" : "rgba(255,255,255,0.06)",
              border: load === l ? "1px solid var(--rtd-cyan)" : "1px solid transparent",
              color: load === l ? "var(--rtd-cyan)" : "var(--rtd-text-secondary)",
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <div className="text-caption text-[var(--rtd-text-tertiary)] -mt-1">Session load, 1 (easy) – 10 (max effort)</div>
      <textarea
        placeholder="Sets (optional) — e.g. 10x100 BR @1:30, main set 6x200 IM"
        value={setsText}
        onChange={(e) => setSetsText(e.target.value)}
        rows={2}
        className="rounded-lg bg-white/[0.06] px-3 py-2 text-subhead outline-none resize-none"
      />
      <Button variant="secondary" disabled={pending || !load} onClick={submit}>
        {done ? "Logged ✓" : "Log session"}
      </Button>
    </GlassCard>
  );
}
