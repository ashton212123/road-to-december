"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { logCmjAction } from "@/app/(app)/more/actions";

export function CmjQuickLog() {
  const [cm, setCm] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function submit() {
    if (!cm) return;
    startTransition(async () => {
      await logCmjAction(Number(cm));
      setDone(true);
      setCm("");
    });
  }

  return (
    <GlassCard className="flex items-center gap-3">
      <div className="flex-1">
        <div className="text-body font-semibold">CMJ — best of 3</div>
        <div className="text-footnote text-[var(--rtd-text-tertiary)]">Weekly fatigue monitor, every Sunday.</div>
      </div>
      <input
        inputMode="decimal"
        placeholder="cm"
        value={cm}
        onChange={(e) => setCm(e.target.value)}
        className="w-16 rounded-lg bg-white/[0.06] px-2 py-2 text-sm text-center outline-none"
      />
      <Button variant="secondary" onClick={submit} disabled={pending || !cm}>
        {done ? "✓" : "Log"}
      </Button>
    </GlassCard>
  );
}
