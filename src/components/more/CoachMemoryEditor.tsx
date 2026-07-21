"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { updateAthleteModelAction } from "@/app/(app)/more/actions";

/** Read/edit surface for the coach's persistent athlete model (see
 * lib/coach/athleteModel.ts) -- it's injected into every chat turn and the
 * daily brief, but until now there was no way to see or correct it. */
export function CoachMemoryEditor({ initialModel }: { initialModel: string | null }) {
  const [model, setModel] = useState(initialModel);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialModel ?? "");
  const [pending, startTransition] = useTransition();

  if (!editing && model === null) {
    return (
      <p className="text-subhead text-[var(--rtd-text-secondary)] leading-relaxed">
        The coach builds a persistent picture of you from your daily logs — the first entry appears after
        tomorrow&apos;s brief.
      </p>
    );
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-2.5">
        <p className="text-subhead text-[var(--rtd-text)] leading-relaxed whitespace-pre-wrap">{model}</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setDraft(model ?? "");
            setEditing(true);
          }}
          className="self-start"
        >
          Edit
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={900}
        rows={6}
        aria-label="Coach memory"
        className="rounded-[8px] bg-white/[0.06] px-3.5 py-2.5 text-subhead outline-none resize-none focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          disabled={pending || !draft.trim()}
          onClick={() => {
            const next = draft.trim();
            startTransition(async () => {
              await updateAthleteModelAction(next);
              setModel(next);
              setEditing(false);
            });
          }}
        >
          Save
        </Button>
        <Button type="button" variant="secondary" disabled={pending} onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
      <p className="text-footnote text-[var(--rtd-text-tertiary)]">
        Updated daily by the coach. Edits here overwrite today&apos;s version.
      </p>
    </div>
  );
}
