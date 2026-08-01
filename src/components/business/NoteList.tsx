"use client";

import { useState, useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { Button } from "@/components/ui/Button";
import { addNoteAction, deleteNoteAction } from "@/app/(app)/business/actions";

type Note = { id: number; body: string; createdAt: string | Date };

export function NoteList({ businessId, notes }: { businessId: number; notes: Note[] }) {
  const [pending, startTransition] = useTransition();
  const [body, setBody] = useState("");

  function addNote() {
    if (!body.trim()) return;
    startTransition(async () => {
      await addNoteAction({ businessId, body: body.trim() });
      setBody("");
    });
  }

  return (
    <TerminalPanel className="rtd-stagger">
      {notes.length === 0 && <div className="text-footnote text-[var(--rtd-text-tertiary)]">No notes yet.</div>}
      {notes.map((note) => (
        <div key={note.id} className="flex items-start justify-between gap-2 bg-white/[0.04] rounded-lg px-3 py-2">
          <div className="min-w-0">
            <div className="text-subhead text-[var(--rtd-text)] whitespace-pre-wrap">{note.body}</div>
            <div className="text-caption text-[var(--rtd-text-tertiary)] mt-0.5">
              {new Date(note.createdAt).toLocaleDateString()}
            </div>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => deleteNoteAction(note.id, businessId))}
            className="text-[var(--rtd-red)] text-footnote shrink-0 cursor-pointer hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out rtd-tap-target"
            aria-label="Delete note"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <textarea
          placeholder="Add a note"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="flex-1 rounded-lg bg-white/[0.06] px-3 py-2 text-subhead outline-none resize-none"
        />
        <Button variant="secondary" disabled={pending || !body.trim()} onClick={addNote} className="!px-3 self-end">
          Add
        </Button>
      </div>
    </TerminalPanel>
  );
}
