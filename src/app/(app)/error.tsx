"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6 min-h-[60dvh]">
      <GlassCard className="max-w-sm text-center flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[var(--rtd-red)]/15 flex items-center justify-center text-2xl">
          ⚠️
        </div>
        <div className="rtd-display text-title-3">Something went wrong</div>
        <p className="text-subhead text-[var(--rtd-text-secondary)]">
          Couldn&apos;t load this screen — usually a database connection hiccup. Your logged data is
          safe either way.
        </p>
        <Button onClick={reset} className="mt-1">
          Try again
        </Button>
      </GlassCard>
    </div>
  );
}
