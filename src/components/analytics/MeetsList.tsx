"use client";

import { useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { deleteMeetAction } from "@/app/(app)/analytics/actions";
import { formatSwimTime } from "@/lib/swim/format";
import { todayManilaISO, daysBetween } from "@/lib/time";
import type { ReadinessResult } from "@/lib/swim/readiness";

type Meet = {
  id: number;
  name: string;
  date: string;
  events: { id: number; event: string; currentTimeMs: number | null; targetTimeMs: number; readiness: ReadinessResult }[];
};

const CONFIDENCE_COLOR: Record<ReadinessResult["confidence"], string> = {
  none: "var(--rtd-text-tertiary)",
  low: "var(--rtd-orange)",
  medium: "var(--rtd-cyan)",
  high: "var(--rtd-green)",
};

export function MeetsList({ meets }: { meets: Meet[] }) {
  const [pending, startTransition] = useTransition();
  const today = todayManilaISO();

  if (meets.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {meets.map((meet) => {
        const daysOut = daysBetween(today, meet.date);
        return (
          <GlassCard key={meet.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">{meet.name}</div>
                <div className="text-[10px] text-[var(--rtd-text-tertiary)]">
                  {meet.date} · {daysOut >= 0 ? `${daysOut}d out` : `${Math.abs(daysOut)}d ago`}
                </div>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => deleteMeetAction(meet.id))}
                className="text-[var(--rtd-red)] text-xs"
                aria-label="Delete meet"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {meet.events.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between text-xs">
                  <span className="text-[var(--rtd-text-secondary)]">{ev.event}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--rtd-text-tertiary)]">target {formatSwimTime(ev.targetTimeMs)}</span>
                    {ev.readiness.projectedMs !== null && (
                      <span
                        className="font-semibold"
                        style={{ color: CONFIDENCE_COLOR[ev.readiness.confidence] }}
                      >
                        proj {formatSwimTime(ev.readiness.projectedMs)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}
