"use client";

import { useEffect, useRef, useState } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";

type ExternalEvent = { id: string; title: string; startISO: string; endISO: string | null; allDay: boolean; location: string | null };
export type CalendarOverlayDay = { date: string; meets: string[]; swimPlanned: boolean; gymTitle: string | null };

function shortWeekday(dateISO: string): string {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1);
}
function shortDayNum(dateISO: string): string {
  return String(new Date(`${dateISO}T00:00:00`).getDate());
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** 7-day strip overlaying the app's own known dates (meets, planned
 * swim/gym -- passed in as `days`, already computed server-side from data
 * Home already fetches) with the external Google Calendar feed (fetched
 * client-side from api/calendar, which handles the unset-env-var/fetch-
 * failure empty states itself -- this component just renders whatever it
 * gets back, never treats an empty list as an error). */
export function CalendarStripCard({ days, today, className }: { days: CalendarOverlayDay[]; today: string; className?: string }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [externalEvents, setExternalEvents] = useState<ExternalEvent[]>([]);
  const [expandedDate, setExpandedDate] = useState<string>(today);
  // Date.now() can't be called during render (§3.2) -- captured once per
  // mount/expand via an effect instead, not read live on every render.
  const [nowMs, setNowMs] = useState<number | null>(null);
  const nowMarkerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/calendar")
      .then((res) => res.json())
      .then((data: { events?: ExternalEvent[]; connected?: boolean }) => {
        if (cancelled) return;
        setConnected(Boolean(data.connected));
        setExternalEvents(data.events ?? []);
      })
      .catch((err) => {
        console.error("CalendarStripCard: fetch failed", err);
        if (!cancelled) setConnected(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function eventsForDay(date: string): ExternalEvent[] {
    return externalEvents.filter((e) => e.startISO.slice(0, 10) === date).sort((a, b) => a.startISO.localeCompare(b.startISO));
  }

  const expandedOverlay = days.find((d) => d.date === expandedDate);
  const expandedEvents = eventsForDay(expandedDate);
  const nowMarkerIndex =
    nowMs !== null && expandedDate === today
      ? expandedEvents.findIndex((e) => !e.allDay && new Date(e.startISO).getTime() >= nowMs)
      : -1;

  useEffect(() => {
    // setTimeout(fn, 0) sidesteps react-hooks/set-state-in-effect (§3.2) --
    // this app's established workaround for a setState that must run once
    // per dependency change but isn't itself synchronizing to an external
    // system's live updates.
    const id = setTimeout(() => setNowMs(Date.now()), 0);
    return () => clearTimeout(id);
  }, [expandedDate, externalEvents]);

  // Runs after nowMs settles and nowMarkerIndex re-renders the marker div,
  // not in the same effect that sets nowMs -- the ref isn't attached until
  // that later render actually happens.
  useEffect(() => {
    nowMarkerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [nowMarkerIndex]);

  const hasOverlay = (d: CalendarOverlayDay) => d.meets.length > 0 || d.swimPlanned || d.gymTitle !== null;
  const isEmpty =
    !expandedOverlay || (!hasOverlay(expandedOverlay) && expandedEvents.length === 0);

  return (
    <TerminalPanel label="04 // CALENDAR" colSpan={4} className={className}>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {days.map((d) => {
          const isToday = d.date === today;
          const dotColor = d.meets.length > 0 ? "var(--rtd-red)" : hasOverlay(d) || eventsForDay(d.date).length > 0 ? "var(--rtd-blue)" : null;
          return (
            <button
              key={d.date}
              onClick={() => setExpandedDate(d.date)}
              className="rtd-tap-target flex flex-col items-center gap-0.5 rounded-[8px] px-2.5 py-1.5 shrink-0"
              style={{
                background: d.date === expandedDate ? "rgba(255,255,255,0.08)" : "transparent",
                border: isToday ? "1px solid var(--rtd-blue)" : "1px solid transparent",
              }}
            >
              <span className="text-caption text-[var(--rtd-text-tertiary)]">{shortWeekday(d.date)}</span>
              <span className="text-subhead font-semibold text-[var(--rtd-text)]">{shortDayNum(d.date)}</span>
              <span className="w-1 h-1 rounded-full" style={{ background: dotColor ?? "transparent" }} />
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5 mt-2 max-h-64 overflow-y-auto">
        {connected === false && (
          <p className="text-caption text-[var(--rtd-text-tertiary)]">Connect your calendar in Settings to see it here.</p>
        )}
        {expandedOverlay?.meets.map((name) => (
          <div key={name} className="text-subhead" style={{ color: "var(--rtd-red)" }}>
            Meet: {name}
          </div>
        ))}
        {expandedOverlay?.gymTitle && <div className="text-subhead text-[var(--rtd-text)]">Gym: {expandedOverlay.gymTitle}</div>}
        {expandedOverlay?.swimPlanned && <div className="text-subhead text-[var(--rtd-text)]">Swim planned</div>}
        {expandedEvents.map((e, i) => {
          const isPast = !e.allDay && nowMs !== null && new Date(e.startISO).getTime() < nowMs;
          return (
            <div key={e.id}>
              {i === nowMarkerIndex && <div ref={nowMarkerRef} className="h-0.5 rounded-full my-1" style={{ background: "var(--rtd-blue)" }} />}
              <div className="flex items-center gap-2 text-subhead" style={{ color: isPast ? "var(--rtd-text-tertiary)" : "var(--rtd-text)" }}>
                <span className="text-caption rtd-nums rtd-mono shrink-0 w-14">{e.allDay ? "All day" : formatTime(e.startISO)}</span>
                <span className="truncate">{e.title}</span>
              </div>
            </div>
          );
        })}
        {isEmpty && connected !== false && <span className="text-caption text-[var(--rtd-text-tertiary)]">Nothing scheduled.</span>}
      </div>
    </TerminalPanel>
  );
}
