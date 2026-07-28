"use client";

import { useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { deleteMeetAction } from "@/app/(app)/analytics/actions";
import { formatSwimTime } from "@/lib/swim/format";
import { todayManilaISO, daysBetween } from "@/lib/time";
import type { ReadinessResult } from "@/lib/swim/readiness";
import type { Course } from "@/lib/swim/course";

type Meet = {
  id: number;
  name: string;
  date: string;
  course: Course | null;
  events: { id: number; event: string; currentTimeMs: number | null; targetTimeMs: number; readiness: ReadinessResult }[];
};

const CONFIDENCE_COLOR: Record<ReadinessResult["confidence"], string> = {
  none: "var(--rtd-text-secondary)",
  low: "var(--rtd-orange)",
  medium: "var(--rtd-cyan)",
  high: "var(--rtd-green)",
};

export function MeetsList({ meets }: { meets: Meet[] }) {
  const [pending, startTransition] = useTransition();
  const today = todayManilaISO();

  if (meets.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rtd-stagger">
      {meets.map((meet) => {
        const daysOut = daysBetween(today, meet.date);
        return (
          <TerminalPanel key={meet.id} fill={false}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-body font-semibold flex items-center gap-1.5">
                  {meet.name}
                  {meet.course && (
                    <span className="text-caption font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[var(--rtd-text-tertiary)]">
                      {meet.course}
                    </span>
                  )}
                </div>
                <div className="text-caption text-[var(--rtd-text-secondary)]">
                  <span className="rtd-mono">{meet.date}</span> ·{" "}
                  <span className="rtd-mono">{daysOut >= 0 ? `${daysOut}d out` : `${Math.abs(daysOut)}d ago`}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => deleteMeetAction(meet.id))}
                className="rtd-tap-target text-[var(--rtd-red)] text-footnote cursor-pointer hover:bg-white/[0.04] active:scale-[0.98] transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
                aria-label="Delete meet"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {meet.events.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between text-footnote">
                  <span className="text-[var(--rtd-text-secondary)]">{ev.event}</span>
                  <div className="flex items-center gap-2 rtd-mono">
                    <span className="text-[var(--rtd-text-secondary)]">target {formatSwimTime(ev.targetTimeMs)}</span>
                    {ev.readiness.projectedMs !== null && (
                      <span
                        className="font-semibold"
                        style={{ color: CONFIDENCE_COLOR[ev.readiness.confidence] }}
                      >
                        {ev.readiness.pointsUsed >= 2 ? "proj" : "race"} {formatSwimTime(ev.readiness.projectedMs)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TerminalPanel>
        );
      })}
    </div>
  );
}
