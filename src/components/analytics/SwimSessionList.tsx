"use client";

import { useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { deleteSwimSessionAction } from "@/app/(app)/analytics/actions";

type Session = { id: number; date: string; loadRating: number; setsText: string | null; parsedDistanceM: number | null };

export function SwimSessionList({ sessions }: { sessions: Session[] }) {
  const [pending, startTransition] = useTransition();

  if (sessions.length === 0) {
    return <EmptyState title="No swim sessions logged yet" body="Log training load above after your next practice." />;
  }

  return (
    <GlassCard variant="open" className="flex flex-col gap-2">
      {sessions.slice(0, 10).map((s) => (
        <div key={s.id} className="flex items-center justify-between text-footnote gap-2">
          <div className="min-w-0">
            <span className="text-[var(--rtd-text)]">{s.date}</span>{" "}
            <span className="text-[var(--rtd-text-secondary)]">
              load {s.loadRating}/10{s.parsedDistanceM ? ` · ~${s.parsedDistanceM}m` : ""}
            </span>
            {s.setsText && <div className="text-caption text-[var(--rtd-text-secondary)] truncate">{s.setsText}</div>}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => deleteSwimSessionAction(s.id))}
            className="rtd-tap-target text-[var(--rtd-red)] shrink-0 cursor-pointer hover:bg-white/[0.04] active:scale-[0.98] transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
            aria-label="Delete session"
          >
            ✕
          </button>
        </div>
      ))}
    </GlassCard>
  );
}
