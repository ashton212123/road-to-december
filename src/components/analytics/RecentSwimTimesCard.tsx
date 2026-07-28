"use client";

import { useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { deleteSwimTimeAction } from "@/app/(app)/analytics/actions";
import { formatSwimTime } from "@/lib/swim/format";

type RecentSwimTime = { id: number; date: string; event: string; timeMs: number; meetName: string | null };

/** Pulled out of the old monolithic SwimSection so the Meets view can render
 * it without pulling in the recharts-dependent Analysis pieces. */
export function RecentSwimTimesCard({ recentTimes }: { recentTimes: RecentSwimTime[] }) {
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <SectionHeader title="Recent logged times" className="mb-2" />
      <TerminalPanel variant="open">
        {recentTimes.length === 0 ? (
          <EmptyState title="No times logged yet" body="Log one above after your next set or meet." />
        ) : (
          recentTimes.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-footnote">
              <div className="min-w-0">
                <span className="text-[var(--rtd-text)] font-medium">{t.event}</span>{" "}
                <span className="text-[var(--rtd-text-secondary)] rtd-mono">{formatSwimTime(t.timeMs)}</span>
                <div className="text-caption text-[var(--rtd-text-secondary)]">
                  <span className="rtd-mono">{t.date}</span>
                  {t.meetName ? ` · ${t.meetName}` : ""}
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => deleteSwimTimeAction(t.id))}
                className="rtd-tap-target text-[var(--rtd-red)] ml-2 shrink-0 cursor-pointer hover:bg-white/[0.04] active:scale-[0.98] transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
                aria-label="Delete swim time"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </TerminalPanel>
    </div>
  );
}
