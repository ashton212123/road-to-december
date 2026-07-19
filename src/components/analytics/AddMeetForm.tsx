"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { createMeetAction } from "@/app/(app)/analytics/actions";
import { parseSwimTime } from "@/lib/swim/format";

const EVENTS = ["50 Breast", "100 Breast", "200 Breast", "200 IM", "400 IM"];

type EventRow = { event: string; targetTime: string; currentTime: string };

export function AddMeetForm({ latestTimeByEvent }: { latestTimeByEvent: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<EventRow[]>(
    EVENTS.map((event) => ({ event, targetTime: "", currentTime: "" }))
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)} className="w-full">
        + Add meet
      </Button>
    );
  }

  function updateRow(index: number, field: "targetTime" | "currentTime", value: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function submit() {
    setError(null);
    if (!name.trim() || !date) {
      setError("Meet name and date are required.");
      return;
    }
    const events: { event: string; currentTimeMs: number | null; targetTimeMs: number }[] = [];
    for (const row of rows) {
      if (!row.targetTime.trim()) continue;
      const targetMs = parseSwimTime(row.targetTime);
      if (targetMs === null) {
        setError(`Bad target time for ${row.event}: "${row.targetTime}". Use m:ss.cc or ss.cc.`);
        return;
      }
      const currentMs = row.currentTime.trim() ? parseSwimTime(row.currentTime) : (latestTimeByEvent[row.event] ?? null);
      events.push({ event: row.event, currentTimeMs: currentMs, targetTimeMs: targetMs });
    }
    if (events.length === 0) {
      setError("Add at least one event with a target time.");
      return;
    }
    startTransition(async () => {
      await createMeetAction({ name: name.trim(), date, events });
      setOpen(false);
      setName("");
      setDate("");
      setRows(EVENTS.map((event) => ({ event, targetTime: "", currentTime: "" })));
    });
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="text-title-3">Add meet</div>
      <div className="grid grid-cols-2 gap-2">
        <input
          placeholder="Meet name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg bg-white/[0.06] px-2.5 py-2 text-subhead outline-none col-span-2"
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg bg-white/[0.06] px-2.5 py-2 text-subhead outline-none col-span-2"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map((row, i) => (
          <div key={row.event} className="grid grid-cols-3 gap-2 items-center">
            <span className="text-footnote text-[var(--rtd-text-secondary)] truncate">{row.event}</span>
            <input
              placeholder="target"
              inputMode="decimal"
              value={row.targetTime}
              onChange={(e) => updateRow(i, "targetTime", e.target.value)}
              className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-subhead text-center outline-none"
            />
            <input
              placeholder={latestTimeByEvent[row.event] ? "auto" : "current"}
              inputMode="decimal"
              value={row.currentTime}
              onChange={(e) => updateRow(i, "currentTime", e.target.value)}
              className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-subhead text-center outline-none"
            />
          </div>
        ))}
      </div>

      {error && <div className="text-footnote text-[var(--rtd-red)]">{error}</div>}

      <div className="flex gap-2">
        <Button variant="secondary" disabled={pending} onClick={submit} className="flex-1">
          Create meet
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => setOpen(false)} className="flex-1">
          Cancel
        </Button>
      </div>
    </GlassCard>
  );
}
