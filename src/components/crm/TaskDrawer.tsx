"use client";

import { useEffect, useState, useTransition } from "react";
import { CrmTask } from "@/lib/crm/queries";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  createTaskAction,
  updateTaskAction,
  completeTaskAction,
  uncompleteTaskAction,
  toggleKeyAction,
  setUrgencyAction,
} from "@/app/(app)/life/crm/actions";

type Urgency = "today" | "week" | "month" | "someday";

const URGENCY_OPTIONS: { value: Urgency; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "someday", label: "Someday" },
];

const RAIL_OPTIONS: { value: "life" | "athlete"; label: string }[] = [
  { value: "life", label: "Life" },
  { value: "athlete", label: "Athlete" },
];

/** Slide-over sheet, same chrome as QuickLogSheet.tsx. `task: null` = create
 * mode. isKey/urgency auto-save immediately (the "move to" control the spec
 * asks for on mobile Kanban); everything else batches behind Save. */
export function TaskDrawer({
  task,
  defaultUrgency,
  onClose,
  onRequestDelete,
}: {
  task: CrmTask | null;
  defaultUrgency?: Urgency;
  onClose: () => void;
  onRequestDelete: (task: CrmTask) => void;
}) {
  const isNew = task === null;
  const isMirrored = task ? task.sourceKind !== "manual" && task.sourceKind !== "capture" : false;

  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [category, setCategory] = useState(task?.category ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [timeEstimateMin, setTimeEstimateMin] = useState(task?.timeEstimateMin?.toString() ?? "");
  const [tagsText, setTagsText] = useState(task?.tags?.join(", ") ?? "");
  const [urgency, setUrgency] = useState<Urgency>(task?.urgency ?? defaultUrgency ?? "week");
  const [rail, setRail] = useState<"life" | "athlete">(task?.rail ?? "life");
  const [isKey, setIsKey] = useState(task?.isKey ?? false);

  const [saving, startSave] = useTransition();
  const [quickPending, startQuick] = useTransition();

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  function handleUrgencyChange(next: Urgency) {
    setUrgency(next);
    if (!isNew && task) {
      startQuick(async () => {
        await setUrgencyAction(task.id, next);
      });
    }
  }

  function handleKeyToggle() {
    const next = !isKey;
    setIsKey(next);
    if (!isNew && task) {
      startQuick(async () => {
        await toggleKeyAction(task.id, next);
      });
    }
  }

  function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    startSave(async () => {
      if (isNew) {
        await createTaskAction({
          title: trimmedTitle,
          notes: notes.trim() || null,
          urgency,
          rail,
          category: category.trim() || null,
          dueDate: dueDate || null,
          timeEstimateMin: timeEstimateMin ? Number(timeEstimateMin) : null,
          tags: tags.length ? tags : null,
        });
      } else if (task) {
        await updateTaskAction(task.id, {
          notes: notes.trim() || null,
          category: category.trim() || null,
          dueDate: dueDate || null,
          timeEstimateMin: timeEstimateMin ? Number(timeEstimateMin) : null,
          tags: tags.length ? tags : null,
          ...(isMirrored ? {} : { title: trimmedTitle }),
        });
      }
      onClose();
    });
  }

  function handleComplete() {
    if (!task) return;
    startQuick(async () => {
      if (task.completedAt) {
        await uncompleteTaskAction(task.id);
      } else {
        await completeTaskAction(task.id);
      }
      onClose();
    });
  }

  return (
    <div
      className="rtd-glass-blur rtd-backdrop-enter fixed inset-0 z-50 flex items-end md:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? "New task" : "Edit task"}
    >
      <div
        className="rtd-glass rtd-glass-blur rtd-sheet-enter p-3.5 md:p-4 flex flex-col gap-3 w-full md:max-w-md rounded-t-[16px] md:rounded-[10px] max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: "rgba(20,20,22,0.92)", paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <span className="text-body font-semibold">{isNew ? "New task" : "Task"}</span>
          <div className="flex items-center gap-3">
            {!isNew && (
              <button
                type="button"
                onClick={handleKeyToggle}
                disabled={quickPending}
                aria-pressed={isKey}
                aria-label={isKey ? "Unstar" : "Star as key task"}
                className="rtd-tap-target text-headline cursor-pointer active:scale-90 transition-transform duration-150 ease-out"
                style={{ color: isKey ? "var(--rtd-purple)" : "var(--rtd-text-tertiary)" }}
              >
                ★
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" className="rtd-tap-target cursor-pointer text-[var(--rtd-text-tertiary)]">
              ✕
            </button>
          </div>
        </div>

        {isMirrored && task && (
          <div className="text-caption-1 text-[var(--rtd-text-tertiary)] px-2.5 py-1.5 rounded-lg bg-white/[0.04]">
            Mirrored from {task.sourceKind === "business" ? "Business" : "Canvas"} — title stays in sync from there.
          </div>
        )}

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          disabled={isMirrored}
          className="bg-white/[0.04] rounded-lg px-3 py-2.5 text-body outline-none focus:ring-2 focus:ring-[var(--rtd-blue)] disabled:opacity-60"
        />

        <SegmentedControl options={URGENCY_OPTIONS} value={urgency} onChange={handleUrgencyChange} />
        <SegmentedControl options={RAIL_OPTIONS} value={rail} onChange={setRail} />

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          disabled={isMirrored}
          rows={2}
          className="bg-white/[0.04] rounded-lg px-3 py-2.5 text-subhead outline-none resize-none focus:ring-2 focus:ring-[var(--rtd-blue)] disabled:opacity-60"
        />

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-caption-1 text-[var(--rtd-text-tertiary)]">Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white/[0.04] rounded-lg px-3 py-2 text-subhead outline-none focus:ring-2 focus:ring-[var(--rtd-blue)]"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-caption-1 text-[var(--rtd-text-tertiary)]">Est. minutes</span>
            <input
              type="number"
              inputMode="numeric"
              value={timeEstimateMin}
              onChange={(e) => setTimeEstimateMin(e.target.value)}
              className="bg-white/[0.04] rounded-lg px-3 py-2 text-subhead outline-none focus:ring-2 focus:ring-[var(--rtd-blue)]"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-caption-1 text-[var(--rtd-text-tertiary)]">Category</span>
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-white/[0.04] rounded-lg px-3 py-2 text-subhead outline-none focus:ring-2 focus:ring-[var(--rtd-blue)]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-caption-1 text-[var(--rtd-text-tertiary)]">Tags (comma-separated)</span>
          <input
            type="text"
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            className="bg-white/[0.04] rounded-lg px-3 py-2 text-subhead outline-none focus:ring-2 focus:ring-[var(--rtd-blue)]"
          />
        </label>

        <div className="flex items-center gap-2 mt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex-1 rtd-tap-target rounded-full py-2.5 text-subhead font-semibold cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out disabled:opacity-50"
            style={{ background: "var(--rtd-blue)", color: "#fff" }}
          >
            {saving ? "Saving…" : isNew ? "Create" : "Save"}
          </button>
          {!isNew && task && (
            <button
              type="button"
              onClick={handleComplete}
              disabled={quickPending}
              className="rtd-tap-target rounded-full px-4 py-2.5 text-subhead font-semibold cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-out bg-white/[0.06] disabled:opacity-50"
            >
              {task.completedAt ? "Reopen" : "Complete"}
            </button>
          )}
        </div>

        {!isNew && task && !isMirrored && (
          <button
            type="button"
            onClick={() => onRequestDelete(task)}
            className="rtd-tap-target text-footnote text-[var(--rtd-red)] cursor-pointer text-center py-1"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
