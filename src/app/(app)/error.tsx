"use client";

import { useEffect, useState } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { Button } from "@/components/ui/Button";

const RETRY_KEY = "rtd-err-retry";
const RETRY_WINDOW_MS = 30_000;

type Phase = "checking" | "reconnecting" | "failed" | "failed-again";

/** Most hits here are a transient Supabase pooler hiccup, not a real break --
 * the first error in any 30s window self-heals with one silent retry
 * instead of slamming the athlete with a wall on a cold app open. Every
 * setState happens inside a timer callback (subscribing to an external
 * clock), never as a bare statement in an effect body -- the shape the
 * compiler's set-state-in-effect rule requires. */
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    const checkTimer = setTimeout(() => {
      const lastAttempt = Number(sessionStorage.getItem(RETRY_KEY) ?? 0);
      const withinWindow = lastAttempt > 0 && Date.now() - lastAttempt < RETRY_WINDOW_MS;
      sessionStorage.setItem(RETRY_KEY, String(Date.now()));
      setPhase(withinWindow ? "failed-again" : "reconnecting");
    }, 0);
    return () => clearTimeout(checkTimer);
  }, []);

  useEffect(() => {
    if (phase !== "reconnecting") return;
    const retryTimer = setTimeout(() => {
      reset();
    }, 800);
    return () => clearTimeout(retryTimer);
  }, [phase, reset]);

  if (phase === "checking") return null;

  if (phase === "reconnecting") {
    return (
      <div className="flex-1 flex items-center justify-center p-6 min-h-[60dvh]">
        <TerminalPanel className="max-w-sm text-center items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--rtd-text-tertiary)] border-t-transparent animate-spin" />
          <p className="text-subhead text-[var(--rtd-text-secondary)]">Reconnecting…</p>
        </TerminalPanel>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-[60dvh]">
      <TerminalPanel className="max-w-sm text-center items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[var(--rtd-red)]/15 flex items-center justify-center text-2xl">
          ⚠️
        </div>
        <div className="rtd-display text-title-3">Something went wrong</div>
        <p className="text-subhead text-[var(--rtd-text-secondary)]">
          {phase === "failed-again"
            ? "Still couldn't reach the database — give it a few seconds and hit Try again. Your logged data is safe either way."
            : "Couldn't load this screen — usually a database connection hiccup. Your logged data is safe either way."}
        </p>
        <Button onClick={reset} className="mt-1">
          Try again
        </Button>
      </TerminalPanel>
    </div>
  );
}
