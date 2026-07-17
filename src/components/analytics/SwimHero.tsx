"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatSwimTime } from "@/lib/swim/format";
import type { ReadinessResult } from "@/lib/swim/readiness";

const EVENTS = ["50 Breast", "100 Breast", "200 Breast", "200 IM", "400 IM"];

type MeetEventWithReadiness = {
  event: string;
  targetTimeMs: number;
  readiness: ReadinessResult;
  meetName: string;
  meetDate: string;
};

const CONFIDENCE_COLOR: Record<ReadinessResult["confidence"], string> = {
  none: "var(--rtd-text-tertiary)",
  low: "var(--rtd-orange)",
  medium: "var(--rtd-cyan)",
  high: "var(--rtd-green)",
};

export function SwimHero({
  allSwimTimesByEvent,
  meetEventsFlat,
}: {
  allSwimTimesByEvent: Record<string, { date: string; timeMs: number }[]>;
  meetEventsFlat: MeetEventWithReadiness[];
}) {
  const [event, setEvent] = useState("200 Breast");

  const times = allSwimTimesByEvent[event] ?? [];
  const currentBest = times.length > 0 ? Math.min(...times.map((t) => t.timeMs)) : null;

  const nearestMeetEvent = meetEventsFlat
    .filter((e) => e.event === event)
    .sort((a, b) => (a.meetDate < b.meetDate ? -1 : 1))[0];

  return (
    <GlassCard className="flex flex-col gap-3 rtd-fade-in">
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
        {EVENTS.map((ev) => (
          <button
            key={ev}
            onClick={() => setEvent(ev)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
            style={{
              background: event === ev ? "var(--rtd-blue)" : "rgba(255,255,255,0.06)",
              color: event === ev ? "#fff" : "var(--rtd-text-secondary)",
            }}
          >
            {ev}
          </button>
        ))}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="rtd-micro-label">Current best</div>
          <div className="rtd-display text-4xl mt-1 transition-all duration-500">
            {currentBest !== null ? formatSwimTime(currentBest) : "—"}
          </div>
        </div>
        {nearestMeetEvent && (
          <div className="text-right">
            <div className="rtd-micro-label">Projected · {nearestMeetEvent.meetName}</div>
            <div
              className="text-2xl font-bold mt-1 transition-colors duration-500"
              style={{ color: CONFIDENCE_COLOR[nearestMeetEvent.readiness.confidence] }}
            >
              {nearestMeetEvent.readiness.projectedMs !== null ? formatSwimTime(nearestMeetEvent.readiness.projectedMs) : "—"}
            </div>
          </div>
        )}
      </div>

      {nearestMeetEvent && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-[var(--rtd-text-secondary)]">
            Target {formatSwimTime(nearestMeetEvent.targetTimeMs)}
            {nearestMeetEvent.readiness.gapToTargetMs !== null && (
              <span style={{ color: nearestMeetEvent.readiness.gapToTargetMs <= 0 ? "var(--rtd-green)" : "var(--rtd-orange)" }}>
                {" "}
                ({nearestMeetEvent.readiness.gapToTargetMs <= 0 ? "-" : "+"}
                {Math.abs(nearestMeetEvent.readiness.gapToTargetMs / 1000).toFixed(2)}s)
              </span>
            )}
          </span>
          <span
            className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{
              background: `${CONFIDENCE_COLOR[nearestMeetEvent.readiness.confidence]}22`,
              color: CONFIDENCE_COLOR[nearestMeetEvent.readiness.confidence],
            }}
          >
            {nearestMeetEvent.readiness.confidence} confidence
          </span>
        </div>
      )}

      {!nearestMeetEvent && times.length === 0 && (
        <div className="text-xs text-[var(--rtd-text-tertiary)]">Log a time for {event} to see your trend here.</div>
      )}
    </GlassCard>
  );
}
