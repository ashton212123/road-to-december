"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { ImportSessionButton } from "@/components/train/ImportSessionButton";
import { SwimSessionLogger } from "./SwimSessionLogger";

/** Top of the Log view -- the ONE thing the athlete asked for and couldn't
 * find: type/paste a session, AI structures and logs it. The manual
 * load-only logger still exists but collapses behind a disclosure so it's
 * not competing for attention with the thing that actually saves time. */
export function SwimLogHero() {
  const [importOpen, setImportOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  return (
    <GlassCard className="flex flex-col gap-2.5">
      <div className="text-title-3">Log a swim</div>
      <p className="text-subhead text-[var(--rtd-text-secondary)]">
        Type or paste your session exactly how you&apos;d tell a teammate — AI structures and logs it.
      </p>
      <Button onClick={() => setImportOpen(true)}>Log with AI</Button>
      <ImportSessionButton phaseId={null} todayExercises={[]} hideTrigger open={importOpen} onOpenChange={setImportOpen} />

      {manualOpen ? (
        <SwimSessionLogger />
      ) : (
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="text-caption text-[var(--rtd-text-tertiary)] cursor-pointer hover:text-[var(--rtd-text-secondary)] self-start"
        >
          Log manually instead
        </button>
      )}
    </GlassCard>
  );
}
