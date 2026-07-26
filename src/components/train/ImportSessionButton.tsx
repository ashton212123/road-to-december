"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  estimateSessionImportAction,
  saveGymSessionImportAction,
  checkStravaConfiguredAction,
  sendSessionToStravaAction,
} from "@/app/(app)/train/importActions";
import { logSwimSessionAction } from "@/app/(app)/analytics/actions";
import type { ParseSessionResult, ParsedGymExercise } from "@/lib/train/importSession";
import { SwimLogSheet } from "@/components/swim/SwimLogSheet";

type TodayExercise = { id: number; name: string };

function fuzzyMatchId(name: string, exercises: TodayExercise[]): number | null {
  const norm = name.toLowerCase().trim();
  const exact = exercises.find((e) => e.name.toLowerCase() === norm);
  if (exact) return exact.id;
  const partial = exercises.find((e) => e.name.toLowerCase().includes(norm) || norm.includes(e.name.toLowerCase()));
  return partial?.id ?? null;
}

type GymRow = ParsedGymExercise & { exerciseId: number | null; discarded: boolean };

/** V4 P4 -- paste a session, one Groq call structures it, review before
 * anything saves. Shared between Train (today header) and Home's Today's
 * Plan card, both of which already have today's phase + its exercise list
 * on hand for the gym fuzzy-match. */
export function ImportSessionButton({
  phaseId,
  todayExercises,
  compact = false,
  hideTrigger = false,
  open: openProp,
  onOpenChange,
}: {
  phaseId: string | null;
  todayExercises: TodayExercise[];
  compact?: boolean;
  /** Renders no trigger button of its own -- controlled entirely via `open`/`onOpenChange` by a parent (Home's quick-log sheet reuses this same flow instead of duplicating it). */
  hideTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  function setOpen(v: boolean) {
    setOpenState(v);
    onOpenChange?.(v);
  }
  const [text, setText] = useState("");
  const [result, setResult] = useState<ParseSessionResult | null | "error">(null);
  const [gymRows, setGymRows] = useState<GymRow[]>([]);
  const [estimating, startEstimate] = useTransition();
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const [unstructuredLoad, setUnstructuredLoad] = useState(5);
  const [savingUnstructured, startSaveUnstructured] = useTransition();
  const [stravaConfigured, setStravaConfigured] = useState(false);
  const [stravaState, setStravaState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [, startStrava] = useTransition();

  useEffect(() => {
    checkStravaConfiguredAction().then(setStravaConfigured);
  }, []);

  function reset() {
    setText("");
    setResult(null);
    setGymRows([]);
    setSaved(false);
    setStravaState("idle");
  }

  function estimate() {
    if (!text.trim()) return;
    startEstimate(async () => {
      const parsed = await estimateSessionImportAction(text);
      if (!parsed) {
        setResult("error");
        return;
      }
      setResult(parsed);
      // Swim structuring itself is delegated to SwimLogSheet (loop 33's
      // AI-first engine) below -- this classify-only call just needs to know
      // which kind of session it is.
      if (parsed.kind === "gym") {
        setGymRows(
          parsed.exercises.map((ex) => ({ ...ex, exerciseId: fuzzyMatchId(ex.exerciseName, todayExercises), discarded: false }))
        );
      }
    });
  }

  // Logging must never dead-end on a parse failure -- if AI structuring
  // fails, the raw text still saves as-is (distance/pace just won't parse
  // from it), same swim-session table `logSwimSessionAction` already writes
  // to from the manual logger.
  function saveUnstructured() {
    startSaveUnstructured(async () => {
      await logSwimSessionAction({ loadRating: unstructuredLoad, setsText: text.trim() || null });
      setSaved(true);
    });
  }

  // Gym-only now -- swim saving happens inside the embedded SwimLogSheet
  // below, which calls onSaved to flip this same shared "saved" screen.
  function save() {
    startSave(async () => {
      if (result === null || result === "error" || result.kind !== "gym" || !phaseId) return;
      const sets = gymRows
        .filter((r) => !r.discarded && r.exerciseId !== null)
        .flatMap((r) => r.sets.map((s) => ({ exerciseId: r.exerciseId as number, weightKg: s.weightKg, reps: s.reps, rpe: s.rpe })));
      await saveGymSessionImportAction({ phaseId, sets });
      setSaved(true);
    });
  }

  function sendToStrava() {
    if (result === null || result === "error" || result.kind !== "gym") return;
    startStrava(async () => {
      setStravaState("sending");
      const ok = await sendSessionToStravaAction({
        kind: "gym",
        setsText: gymRows.map((r) => r.exerciseName).join(", "),
        elapsedMinutes: 60,
      });
      setStravaState(ok ? "sent" : "failed");
    });
  }

  return (
    <>
      {!hideTrigger && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            compact
              ? "text-caption px-2.5 py-1.5 rounded-full bg-white/[0.06] text-[var(--rtd-text-secondary)] cursor-pointer hover:brightness-110 active:scale-[0.98] transition-transform duration-150 ease-out"
              : "text-footnote font-medium px-3 py-1.5 rounded-full bg-white/[0.06] text-[var(--rtd-text-secondary)] cursor-pointer hover:brightness-110 active:scale-[0.98] transition-transform duration-150 ease-out"
          }
        >
          Import session
        </button>
      )}

      {open && (
        <div
          className="rtd-glass-blur rtd-backdrop-enter fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => {
            setOpen(false);
            reset();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Import session"
        >
          <div
            className="rtd-glass rtd-glass-blur rtd-dialog-enter p-3.5 md:p-4 flex flex-col gap-3 max-w-lg w-full max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: "rgba(20,20,22,0.9)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-body font-semibold">Import session</span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                aria-label="Close"
                className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--rtd-text-tertiary)] cursor-pointer hover:bg-white/10 hover:text-[var(--rtd-text)]"
              >
                ✕
              </button>
            </div>

            {result === null && (
              <>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  placeholder="Paste your session -- e.g. W/U 400 fr, 8x50 br @1:10 hold 38, 4x100 IM @1:50, 6x200 pull @3:00, W/D 200"
                  className="rounded-lg bg-white/[0.06] px-3 py-2 text-subhead outline-none resize-none"
                />
                <Button onClick={estimate} disabled={estimating || !text.trim()}>
                  {estimating ? "Reading it…" : "Estimate"}
                </Button>
              </>
            )}

            {result === "error" && (
              <>
                <div className="rtd-strip" style={{ background: "rgba(255,159,10,0.12)", color: "var(--rtd-orange)" }}>
                  Couldn&apos;t parse this session — try again, or save it as-is below.
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={5}
                  className="rounded-lg bg-white/[0.06] px-3 py-2 text-subhead outline-none resize-none"
                />
                <Button onClick={estimate} disabled={estimating || !text.trim()}>
                  {estimating ? "Reading it…" : "Try again"}
                </Button>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-caption text-[var(--rtd-text-secondary)]">Session load</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={unstructuredLoad}
                    onChange={(e) => setUnstructuredLoad(Math.max(1, Math.min(10, Number(e.target.value) || 5)))}
                    className="w-14 rounded bg-white/[0.06] px-1.5 py-1 text-caption outline-none rtd-nums"
                  />
                  <span className="text-caption text-[var(--rtd-text-tertiary)]">/10</span>
                </div>
                <Button variant="secondary" onClick={saveUnstructured} disabled={savingUnstructured || !text.trim()}>
                  {savingUnstructured ? "Saving…" : "Save as unstructured"}
                </Button>
              </>
            )}

            {saved && (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-title-2"
                  style={{ background: "rgba(48,209,88,0.15)" }}
                >
                  <span aria-hidden="true">✓</span>
                </div>
                <div className="text-body font-semibold text-[var(--rtd-text)]">Session saved</div>
                {stravaConfigured && result !== null && result !== "error" && result.kind === "gym" && (
                  <Button variant="secondary" onClick={sendToStrava} disabled={stravaState === "sending" || stravaState === "sent"}>
                    {stravaState === "sent" ? "Sent to Strava ✓" : stravaState === "sending" ? "Sending…" : stravaState === "failed" ? "Couldn't send — retry" : "Send to Strava"}
                  </Button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  className="text-caption text-[var(--rtd-text-tertiary)] cursor-pointer hover:text-[var(--rtd-text-secondary)]"
                >
                  Close
                </button>
              </div>
            )}

            {!saved && result !== null && result !== "error" && result.kind === "swim" && (
              <SwimLogSheet embedded initialText={text} autoAnalyze onSaved={() => setSaved(true)} />
            )}

            {!saved && result !== null && result !== "error" && result.kind === "gym" && (
              <>
                <div className="flex flex-col gap-3">
                  {gymRows.map((row, i) => (
                    <div key={i} className="rounded-lg bg-white/[0.04] p-2.5 flex flex-col gap-1.5" style={{ opacity: row.discarded ? 0.4 : 1 }}>
                      <div className="flex items-center gap-2">
                        <select
                          value={row.exerciseId ?? ""}
                          onChange={(e) =>
                            setGymRows((prev) =>
                              prev.map((p, idx) => (idx === i ? { ...p, exerciseId: e.target.value ? Number(e.target.value) : null } : p))
                            )
                          }
                          className="flex-1 min-w-0 rounded bg-white/[0.06] px-2 py-1.5 text-subhead outline-none"
                        >
                          <option value="">{row.exerciseName} — no match, pick one</option>
                          {todayExercises.map((ex) => (
                            <option key={ex.id} value={ex.id}>
                              {ex.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setGymRows((prev) => prev.map((p, idx) => (idx === i ? { ...p, discarded: !p.discarded } : p)))}
                          className="text-caption px-2 py-1 rounded-full bg-white/[0.06] text-[var(--rtd-text-tertiary)] cursor-pointer shrink-0"
                        >
                          {row.discarded ? "Discarded" : "Discard"}
                        </button>
                      </div>
                      <div className="text-caption text-[var(--rtd-text-tertiary)]">
                        {row.sets.map((s) => `${s.weightKg ?? "–"}kg x ${s.reps ?? "–"}${s.rpe ? ` @${s.rpe}` : ""}`).join(" · ")}
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={save} disabled={saving || gymRows.every((r) => r.discarded || r.exerciseId === null)}>
                  {saving ? "Saving…" : "Confirm & save"}
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
