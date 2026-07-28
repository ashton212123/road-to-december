"use client";

import { useState, useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { IconChevronDown } from "@/components/ui/icons";
import { logSwimTimeAction } from "@/app/(app)/analytics/actions";
import { analyzeSwimTimeAction } from "@/app/(app)/swim/actions";
import { parseSwimTime, formatSwimTime } from "@/lib/swim/format";
import type { Course } from "@/lib/swim/course";

const KNOWN_EVENTS = ["50 Breast", "100 Breast", "200 Breast", "200 IM", "400 IM"];

function fourFrom(vals: number[] | null): string[] {
  if (!vals || vals.length !== 4) return ["", "", "", ""];
  return vals.map((v) => String(v));
}

/** AI-first: describe the time in your own words, one Groq call fills the
 * structured fields below for review before it saves -- same pattern as
 * SwimLogSheet's session logging. The structured form still works entirely
 * on its own if the parse fails or he'd rather just type it in directly. */
export function SwimTimeLogger() {
  const [pending, startTransition] = useTransition();
  const [aiText, setAiText] = useState("");
  const [parsing, startParse] = useTransition();
  const [parseError, setParseError] = useState<string | null>(null);

  const [event, setEvent] = useState(KNOWN_EVENTS[2]);
  const [customEvent, setCustomEvent] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [logType, setLogType] = useState<"practice" | "meet">("practice");
  const [meetName, setMeetName] = useState("");
  const [course, setCourse] = useState<Course>("SCM");
  const [splits, setSplits] = useState(["", "", "", ""]);
  const [strokeCounts, setStrokeCounts] = useState(["", "", "", ""]);
  const [strokeRates, setStrokeRates] = useState(["", "", "", ""]);
  const [notes, setNotes] = useState("");

  const eventName = event === "custom" ? customEvent.trim() : event;

  function runParse() {
    if (!aiText.trim()) return;
    setParseError(null);
    startParse(async () => {
      const result = await analyzeSwimTimeAction(aiText);
      if (!result) {
        setParseError("Couldn't parse that — check the details below and log it manually.");
        setManualOpen(true);
        return;
      }
      const known = KNOWN_EVENTS.includes(result.event);
      setEvent(known ? result.event : "custom");
      setCustomEvent(known ? "" : result.event);
      setTime(formatSwimTime(result.timeMs));
      setLogType(result.meetName !== null ? "meet" : "practice");
      setMeetName(result.meetName ?? "");
      if (result.course) setCourse(result.course);
      setSplits(fourFrom(result.splits));
      setStrokeCounts(fourFrom(result.strokeCounts));
      setStrokeRates(fourFrom(result.strokeRates));
      setNotes(result.notes ?? "");
      setExpanded(result.splits !== null || result.strokeCounts !== null || result.strokeRates !== null);
      setManualOpen(true);
      setDone(false);
    });
  }

  function submit() {
    setError(null);
    const timeMs = parseSwimTime(time);
    if (!eventName) {
      setError("Enter an event name.");
      return;
    }
    if (timeMs === null) {
      setError("Time format: m:ss.cc or ss.cc (e.g. 2:24.53 or 30.46).");
      return;
    }
    const trimmedMeetName = meetName.trim();
    if (logType === "meet" && !trimmedMeetName) {
      setError("Enter the meet name -- that's what marks this as a race result.");
      return;
    }
    const parsedSplits = splits.map((s) => Number(s)).filter((n) => n > 0);
    const parsedStrokes = strokeCounts.map((s) => Number(s)).filter((n) => n > 0);
    const parsedRates = strokeRates.map((s) => Number(s)).filter((n) => n > 0);

    startTransition(async () => {
      await logSwimTimeAction({
        event: eventName,
        timeMs,
        meetName: logType === "meet" ? trimmedMeetName : null,
        splits: parsedSplits.length === 4 ? parsedSplits : null,
        strokeCounts: parsedStrokes.length === 4 ? parsedStrokes : null,
        strokeRates: parsedRates.length === 4 ? parsedRates : null,
        course,
        notes: notes.trim() || null,
      });
      setDone(true);
      setAiText("");
      setTime("");
      setMeetName("");
      setSplits(["", "", "", ""]);
      setStrokeCounts(["", "", "", ""]);
      setStrokeRates(["", "", "", ""]);
      setNotes("");
      setExpanded(false);
      setManualOpen(false);
    });
  }

  return (
    <TerminalPanel fill={false}>
      <div className="text-title-3">Log a swim time</div>

      <textarea
        value={aiText}
        onChange={(e) => setAiText(e.target.value)}
        rows={2}
        placeholder="Describe it — '200 breast 2:24.53 at champs, SCM, splits 33.5/35.0/36.5/38.0'"
        className="rounded-lg bg-white/[0.06] px-3 py-2 text-subhead outline-none resize-none"
      />
      {parseError && <div className="text-footnote text-[var(--rtd-orange)]">{parseError}</div>}
      <Button variant="secondary" onClick={runParse} disabled={parsing || !aiText.trim()}>
        {parsing ? "Reading it…" : "Parse & fill in"}
      </Button>

      {!manualOpen ? (
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="text-caption text-[var(--rtd-text-tertiary)] cursor-pointer hover:text-[var(--rtd-text-secondary)] self-start"
        >
          Enter manually instead
        </button>
      ) : (
        <div className="flex flex-col gap-3 rtd-fade-in border-t border-[var(--rtd-hairline)] pt-3">
          <SegmentedControl
            options={[
              { value: "practice", label: "Practice" },
              { value: "meet", label: "Meet" },
            ]}
            value={logType}
            onChange={(v) => {
              setLogType(v);
              setCourse(v === "meet" ? "LCM" : "SCM");
              setDone(false);
            }}
          />
          <p className="text-caption text-[var(--rtd-text-tertiary)] -mt-1.5">
            Practice times track training. Only race results drive meet projections.
          </p>

          {logType === "meet" && (
            <input
              placeholder="Meet name"
              value={meetName}
              onChange={(e) => {
                setMeetName(e.target.value);
                setDone(false);
              }}
              className="rounded-lg bg-white/[0.06] px-2.5 py-2 text-subhead outline-none"
            />
          )}

          <SegmentedControl
            options={[
              { value: "SCM", label: "SCM (25m)" },
              { value: "LCM", label: "LCM (50m)" },
            ]}
            value={course}
            onChange={(v) => {
              setCourse(v);
              setDone(false);
            }}
          />

          <div className="grid grid-cols-2 gap-2">
            <select
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setDone(false);
              }}
              className="rounded-lg bg-white/[0.06] px-2.5 py-2 text-subhead outline-none"
            >
              {KNOWN_EVENTS.map((ev) => (
                <option key={ev} value={ev}>
                  {ev}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            <input
              placeholder="m:ss.cc"
              inputMode="decimal"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setDone(false);
              }}
              className="rounded-lg bg-white/[0.06] px-2.5 py-2 text-subhead text-center outline-none"
            />
          </div>

          {event === "custom" && (
            <input
              placeholder="Event name (e.g. 100 Free)"
              value={customEvent}
              onChange={(e) => setCustomEvent(e.target.value)}
              className="rounded-lg bg-white/[0.06] px-2.5 py-2 text-subhead outline-none"
            />
          )}

          <input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-2.5 py-2 text-subhead outline-none"
          />

          {error && <div className="text-footnote text-[var(--rtd-red)]">{error}</div>}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-footnote text-[var(--rtd-text-secondary)] self-start cursor-pointer hover:bg-white/[0.04] active:scale-[0.98] transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
          >
            Splits, stroke counts &amp; rates (optional)
            <span className="transition-transform" style={{ transform: expanded ? "rotate(180deg)" : "none" }}>
              <IconChevronDown />
            </span>
          </button>

          {expanded && (
            <div className="flex flex-col gap-2 rtd-fade-in">
              <div className="grid grid-cols-4 gap-1.5">
                {splits.map((v, i) => (
                  <input
                    key={i}
                    inputMode="decimal"
                    placeholder={`50#${i + 1}`}
                    value={v}
                    onChange={(e) => setSplits((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                    className="rounded-lg bg-white/[0.06] px-1.5 py-1.5 text-subhead text-center outline-none"
                  />
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {strokeCounts.map((v, i) => (
                  <input
                    key={i}
                    inputMode="numeric"
                    placeholder={`strokes#${i + 1}`}
                    value={v}
                    onChange={(e) => setStrokeCounts((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                    className="rounded-lg bg-white/[0.06] px-1.5 py-1.5 text-subhead text-center outline-none"
                  />
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {strokeRates.map((v, i) => (
                  <input
                    key={i}
                    inputMode="decimal"
                    placeholder={`rate#${i + 1}`}
                    value={v}
                    onChange={(e) => setStrokeRates((prev) => prev.map((p, j) => (j === i ? e.target.value : p)))}
                    className="rounded-lg bg-white/[0.06] px-1.5 py-1.5 text-subhead text-center outline-none"
                  />
                ))}
              </div>
            </div>
          )}

          <Button variant="secondary" onClick={submit} disabled={pending}>
            {done ? "Logged ✓" : "Log time"}
          </Button>
        </div>
      )}
    </TerminalPanel>
  );
}
