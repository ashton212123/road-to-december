"use client";

import { useState, useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { Button } from "@/components/ui/Button";
import { IconCheck } from "@/components/ui/icons";
import { addTaskAction, toggleTaskAction, deleteTaskAction } from "@/app/(app)/business/actions";

type Task = { id: number; title: string; done: boolean; dueDate: string | null };

export function TaskList({ businessId, tasks }: { businessId: number; tasks: Task[] }) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState("");

  function addTask() {
    if (!title.trim()) return;
    startTransition(async () => {
      await addTaskAction({ businessId, title: title.trim(), dueDate: null });
      setTitle("");
    });
  }

  return (
    <TerminalPanel className="rtd-stagger">
      {tasks.length === 0 && <div className="text-footnote text-[var(--rtd-text-tertiary)]">No tasks yet.</div>}
      {tasks.map((task) => (
        <div key={task.id} className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => startTransition(() => toggleTaskAction(task.id, businessId, !task.done))}
            disabled={pending}
            aria-pressed={task.done}
            aria-label={task.done ? "Mark not done" : "Mark done"}
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out rtd-tap-target"
            style={{
              background: task.done ? "var(--rtd-green)" : "rgba(255,255,255,0.08)",
              border: task.done ? "none" : "1.5px solid rgba(255,255,255,0.25)",
              color: "var(--rtd-text)",
            }}
          >
            {task.done && <IconCheck size={13} />}
          </button>
          <span
            className="flex-1 text-subhead"
            style={{
              color: task.done ? "var(--rtd-text-tertiary)" : "var(--rtd-text)",
              textDecoration: task.done ? "line-through" : "none",
            }}
          >
            {task.title}
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => deleteTaskAction(task.id, businessId))}
            className="text-[var(--rtd-red)] text-footnote shrink-0 cursor-pointer hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out rtd-tap-target"
            aria-label="Delete task"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <input
          placeholder="New task"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          className="flex-1 rounded-lg bg-white/[0.06] px-3 py-2 text-subhead outline-none"
        />
        <Button variant="secondary" disabled={pending || !title.trim()} onClick={addTask} className="!px-3">
          Add
        </Button>
      </div>
    </TerminalPanel>
  );
}
