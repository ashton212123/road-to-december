"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import {
  addHabitAction,
  renameHabitAction,
  updateHabitSubtasksAction,
  setHabitActiveAction,
  reorderHabitAction,
} from "@/app/(app)/more/actions";
import type { Habit } from "@/lib/db/schema";

const CATEGORIES = ["routine", "swim", "train", "fuel", "school", "recovery"] as const;

function SubtaskEditor({ habit }: { habit: Habit }) {
  const [subtasks, setSubtasks] = useState(habit.subtasks ?? []);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function save(next: { id: string; label: string }[]) {
    setSubtasks(next);
    startTransition(async () => {
      await updateHabitSubtasksAction(habit.id, next).catch((err) =>
        console.error(`HabitEditor: updateHabitSubtasksAction failed for habit ${habit.id}`, err)
      );
    });
  }

  function addSubtask() {
    const label = draft.trim();
    if (!label) return;
    setDraft("");
    save([...subtasks, { id: `${habit.id}-${subtasks.length}-${label.slice(0, 8)}`, label }]);
  }

  return (
    <div className="flex flex-col gap-1.5 pl-4">
      {subtasks.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <span className="text-caption text-[var(--rtd-text-secondary)] flex-1">{s.label}</span>
          <button
            aria-label={`Remove ${s.label}`}
            disabled={pending}
            onClick={() => save(subtasks.filter((x) => x.id !== s.id))}
            className="rtd-tap-target text-caption text-[var(--rtd-red)] px-1"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addSubtask();
          }}
          placeholder="Add subtask…"
          className="flex-1 min-w-0 bg-transparent border-b border-[var(--rtd-hairline)] text-caption text-[var(--rtd-text)] placeholder:text-[var(--rtd-text-tertiary)] focus:outline-none py-1"
        />
        <button onClick={addSubtask} disabled={pending} className="rtd-tap-target text-caption text-[var(--rtd-blue)] px-1.5">
          Add
        </button>
      </div>
    </div>
  );
}

function HabitRow({ habit, isFirst, isLast }: { habit: Habit; isFirst: boolean; isLast: boolean }) {
  const [name, setName] = useState(habit.name);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div
      className="flex flex-col gap-2 py-2.5 border-b border-[var(--rtd-hairline)] last:border-b-0"
      style={{ opacity: habit.active ? 1 : 0.5 }}
    >
      <div className="flex items-center gap-2">
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-0 bg-transparent border-b border-[var(--rtd-hairline)] text-subhead text-[var(--rtd-text)] focus:outline-none py-0.5"
            autoFocus
          />
        ) : (
          <span className="text-subhead font-medium flex-1 min-w-0 truncate">{habit.name}</span>
        )}
        <span className="text-caption text-[var(--rtd-text-tertiary)] shrink-0">{habit.category}</span>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {editing ? (
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={pending || !name.trim()}
              onClick={() => {
                const trimmed = name.trim();
                startTransition(async () => {
                  await renameHabitAction(habit.id, trimmed).catch((err) =>
                    console.error(`HabitEditor: renameHabitAction failed for habit ${habit.id}`, err)
                  );
                  setEditing(false);
                });
              }}
            >
              Save name
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => {
                setName(habit.name);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <button onClick={() => setEditing(true)} className="rtd-tap-target text-caption text-[var(--rtd-blue)] px-1">
            Rename
          </button>
        )}
        <button
          disabled={pending || isFirst}
          onClick={() =>
            startTransition(async () => {
              await reorderHabitAction(habit.id, "up").catch((err) => console.error("HabitEditor: reorderHabitAction failed", err));
            })
          }
          className="rtd-tap-target text-caption text-[var(--rtd-text-tertiary)] px-1 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          disabled={pending || isLast}
          onClick={() =>
            startTransition(async () => {
              await reorderHabitAction(habit.id, "down").catch((err) => console.error("HabitEditor: reorderHabitAction failed", err));
            })
          }
          className="rtd-tap-target text-caption text-[var(--rtd-text-tertiary)] px-1 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await setHabitActiveAction(habit.id, !habit.active).catch((err) =>
                console.error("HabitEditor: setHabitActiveAction failed", err)
              );
            })
          }
          className="rtd-tap-target text-caption text-[var(--rtd-text-secondary)] px-1"
        >
          {habit.active ? "Archive" : "Restore"}
        </button>
      </div>
      <SubtaskEditor habit={habit} />
    </div>
  );
}

export function HabitEditor({ habits }: { habits: Habit[] }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("routine");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col">
      {habits.map((h, i) => (
        <HabitRow key={h.id} habit={h} isFirst={i === 0} isLast={i === habits.length - 1} />
      ))}
      <div className="flex items-center gap-1.5 pt-3 flex-wrap">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New habit name…"
          className="flex-1 min-w-[120px] bg-transparent border-b border-[var(--rtd-hairline)] text-subhead text-[var(--rtd-text)] placeholder:text-[var(--rtd-text-tertiary)] focus:outline-none py-1"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
          className="bg-transparent border-b border-[var(--rtd-hairline)] text-subhead text-[var(--rtd-text)] focus:outline-none py-1"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="bg-[var(--rtd-bg)]">
              {c}
            </option>
          ))}
        </select>
        <Button
          type="button"
          disabled={pending || !name.trim()}
          onClick={() => {
            const trimmed = name.trim();
            setName("");
            startTransition(async () => {
              await addHabitAction(trimmed, category).catch((err) => console.error("HabitEditor: addHabitAction failed", err));
            });
          }}
        >
          Add habit
        </Button>
      </div>
    </div>
  );
}
