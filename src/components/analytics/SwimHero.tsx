"use client";

import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatSwimTime } from "@/lib/swim/format";
import type { ReadinessResult } from "@/lib/swim/readiness";
import type { Course } from "@/lib/swim/course";

const EVENTS = ["50 Breast", "100 Breast", "200 Breast", "200 IM", "400 IM"];

type MeetEventWithReadiness = {
  event: string;
  targetTimeMs: number;
  readiness: ReadinessResult;
  meetName: string;
  meetDate: string;
  course: Course | null;
};

const CONFIDENCE_COLOR: Record<ReadinessResult["confidence"], string> = {
  none: "var(--rtd-text-secondary)",
  low: "var(--rtd-orange)",
  medium: "var(--rtd-cyan)",
  high: "var(--rtd-green)",
};

export function SwimHero({
  allSwimTimesByEvent,
  meetEventsFlat,
}: {
  allSwimTimesByEvent: Record<string, { date: string; timeMs: number; isRace: boolean }[]>;
  meetEventsFlat: MeetEventWithReadiness[];
}) {
  const [event, setEvent] = useState("200 Breast");

  const times = allSwimTimesByEvent[event] ?? [];
  const practiceTimes = times.filter((t) => !t.isRace);
  const practiceBest = practiceTimes.length > 0 ? Math.min(...practiceTimes.map((t) => t.timeMs)) : null;

  const nearestMeetEvent = meetEventsFlat
    .filter((e) => e.event === event)
    .sort((a, b) => (a.meetDate < b.meetDate ? -1 : 1))[0];
  // Course-scoped best (never blended SCM/LCM) when there's a target meet to
  // scope against; otherwise fall back to the all-course PB, unbadged, so an
  // event with no meet target still shows something rather than nothing.
  const raceTimes = times.filter((t) => t.isRace);
  const currentBest = nearestMeetEvent
    ? nearestMeetEvent.readiness.currentBestMs
    : raceTimes.length > 0
      ? Math.min(...raceTimes.map((t) => t.timeMs))
      : null;
  const currentBestCourse = nearestMeetEvent ? nearestMeetEvent.course : null;
  // Only a real trend fit (>=2 race results) earns the "projected" label --
  // a single race point renders its own timeMs verbatim as projectedMs, which
  // would otherwise read as a prediction it isn't.
  const showProjection = nearestMeetEvent && nearestMeetEvent.readiness.pointsUsed >= 2 && nearestMeetEvent.readiness.projectedMs !== null;

  return (
    <GlassCard className="flex flex-col gap-3 rtd-fade-in">
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-0.5">
        {EVENTS.map((ev) => (
          <button
            key={ev}
            onClick={() => setEvent(ev)}
            className="shrink-0 px-3 py-1.5 rounded-full text-subhead font-semibold transition-[background-color,color,transform] duration-150 ease-out cursor-pointer hover:bg-white/[0.06] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
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
          <div className="rtd-micro-label flex items-center gap-1.5">
            Current best (race)
            {currentBestCourse && (
              <span className="text-caption font-semibold px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[var(--rtd-text-tertiary)] normal-case tracking-normal">
                {currentBestCourse}
              </span>
            )}
          </div>
          <div className="rtd-display text-large-title mt-1 transition-[color,opacity] duration-500">
            {currentBest !== null ? formatSwimTime(currentBest) : "—"}
          </div>
          {practiceBest !== null && (
            <div className="text-footnote text-[var(--rtd-text-tertiary)] rtd-nums mt-0.5">practice best {formatSwimTime(practiceBest)}</div>
          )}
        </div>
        {showProjection && (
          <div className="text-right">
            <div className="rtd-micro-label">Projected from race results · {nearestMeetEvent.meetName}</div>
            <div
              className="text-title-1 mt-1 transition-colors duration-500"
              style={{ color: CONFIDENCE_COLOR[nearestMeetEvent.readiness.confidence] }}
            >
              {formatSwimTime(nearestMeetEvent.readiness.projectedMs as number)}
            </div>
          </div>
        )}
      </div>

      {nearestMeetEvent?.readiness.convertedSupport && (
        <div className="text-caption text-[var(--rtd-orange)]">{nearestMeetEvent.readiness.convertedSupport.note}</div>
      )}

      {nearestMeetEvent && currentBest !== null && (
        <div className="flex items-center justify-between text-footnote">
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
            className="text-caption font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{
              background: `${CONFIDENCE_COLOR[nearestMeetEvent.readiness.confidence]}22`,
              color: CONFIDENCE_COLOR[nearestMeetEvent.readiness.confidence],
            }}
          >
            {nearestMeetEvent.readiness.confidence} confidence
          </span>
        </div>
      )}

      {currentBest === null && practiceBest === null && (
        <div className="text-subhead text-[var(--rtd-text-tertiary)]">Log a time for {event} to see your trend here.</div>
      )}
      {currentBest === null && practiceBest !== null && (
        <div className="text-subhead text-[var(--rtd-text-tertiary)]">
          Practice times only — log a meet result to project readiness for {event}.
        </div>
      )}
    </GlassCard>
  );
}
