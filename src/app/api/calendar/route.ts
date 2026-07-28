import ICAL from "ical.js";
import { todayManilaISO, addDaysISO } from "@/lib/time";

// Fetches on every uncached call, so a 5-min module-memory cache (below)
// carries the actual request-shaping -- this must never itself be cached by
// Next's data cache (§7: "respond cache-control: no-store").
export const dynamic = "force-dynamic";

export type CalendarEvent = {
  id: string;
  title: string;
  startISO: string;
  endISO: string | null;
  allDay: boolean;
  location: string | null;
};

// Module-memory cache -- survives across requests within the same server
// instance, cleared on a cold start/redeploy. 5 minutes per §7.
let cache: { fetchedAt: number; events: CalendarEvent[] } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function toCalendarEvent(event: ICAL.Event, start: ICAL.Time, end: ICAL.Time | null): CalendarEvent {
  return {
    id: `${event.uid}-${start.toUnixTime()}`,
    title: event.summary || "(untitled event)",
    startISO: start.toJSDate().toISOString(),
    endISO: end ? end.toJSDate().toISOString() : null,
    allDay: start.isDate,
    location: event.location || null,
  };
}

/** ical.js only (§3.5 -- never node-ical/rrule, a BigInt bundler bug on
 * Vercel prod only). Recurring events expand via event.iterator(), which
 * can run forever for an unbounded rule, so every occurrence is checked
 * against the window and the loop breaks the moment it runs past the end --
 * never collected in full first. */
function expandEvents(icsText: string, windowStart: Date, windowEnd: Date): CalendarEvent[] {
  const jcalData = ICAL.parse(icsText);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents("vevent");

  const events: CalendarEvent[] = [];
  for (const vevent of vevents) {
    const event = new ICAL.Event(vevent);

    if (event.isRecurring()) {
      const iterator = event.iterator();
      let next: ICAL.Time | null;
      while ((next = iterator.next())) {
        const occurrenceDate = next.toJSDate();
        if (occurrenceDate > windowEnd) break;
        if (occurrenceDate < windowStart) continue;
        const occ = event.getOccurrenceDetails(next);
        events.push(toCalendarEvent(event, occ.startDate, occ.endDate));
      }
    } else {
      const start = event.startDate.toJSDate();
      if (start >= windowStart && start <= windowEnd) {
        events.push(toCalendarEvent(event, event.startDate, event.endDate));
      }
    }
  }

  return events.sort((a, b) => a.startISO.localeCompare(b.startISO));
}

export async function GET() {
  const icalUrl = process.env.GOOGLE_CALENDAR_ICAL_URL;

  // No env var set -> a clean empty state, never an error (§7's own gate).
  if (!icalUrl) {
    return Response.json({ events: [], connected: false }, { headers: { "cache-control": "no-store" } });
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return Response.json({ events: cache.events, connected: true }, { headers: { "cache-control": "no-store" } });
  }

  const today = todayManilaISO();
  const windowStart = new Date(`${today}T00:00:00`);
  const windowEnd = new Date(`${addDaysISO(today, 14)}T23:59:59`);

  try {
    const res = await fetch(icalUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const icsText = await res.text();
    const events = expandEvents(icsText, windowStart, windowEnd);
    cache = { fetchedAt: Date.now(), events };
    return Response.json({ events, connected: true }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    console.error("/api/calendar: fetch/parse failed", err);
    // Connected (env var is set) but the fetch/parse itself failed --
    // still degrades to an empty list rather than a 500, same "never an
    // error" spirit as the unset-env-var case, just a different reason.
    return Response.json({ events: [], connected: true, error: "calendar fetch failed" }, { headers: { "cache-control": "no-store" } });
  }
}
