"use client";

import { useState } from "react";
import { JournalRecorder } from "./JournalRecorder";
import type { JournalEntry } from "@/lib/db/schema";

function EntryCard({ entry }: { entry: JournalEntry }) {
  const [showRaw, setShowRaw] = useState(false);
  const rawText = entry.transcript || entry.rawText;

  return (
    <div className="rtd-glass rounded-[10px] p-3.5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-subhead font-semibold">{entry.entryDate}</span>
        <span className="text-caption text-[var(--rtd-text-tertiary)] uppercase">{entry.source}</span>
      </div>
      <p className="text-subhead text-[var(--rtd-text)] leading-relaxed whitespace-pre-wrap">{entry.summary ?? rawText ?? "—"}</p>
      {rawText && (
        <button type="button" onClick={() => setShowRaw((v) => !v)} className="text-caption text-[var(--rtd-blue)] self-start">
          {showRaw ? "Hide raw" : "Show raw"}
        </button>
      )}
      {showRaw && rawText && (
        <p className="text-caption text-[var(--rtd-text-secondary)] leading-relaxed whitespace-pre-wrap border-t border-[var(--rtd-hairline)] pt-2">
          {rawText}
        </p>
      )}
    </div>
  );
}

export function JournalClient({ entries }: { entries: JournalEntry[] }) {
  return (
    <div className="flex flex-col gap-3">
      <JournalRecorder />
      {entries.length === 0 && <p className="text-subhead text-[var(--rtd-text-tertiary)]">No journal entries yet.</p>}
      {entries.map((entry) => (
        <EntryCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
