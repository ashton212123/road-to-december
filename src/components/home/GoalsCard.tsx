"use client";

import { useState, useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { IconCheck } from "@/components/ui/icons";
import { addGoalAction, toggleGoalAction, deleteGoalAction, reorderGoalAction } from "@/app/(app)/home/actions";
import type { GoalRow } from "@/lib/goals/queries";

// No local optimistic copy here (unlike HabitsCard) -- renders straight from
// props and waits for revalidatePath/updateTag after each action, same
// choice KanbanView.tsx made for the same §3.7 clobber reason: nothing to
// clobber if there's no independent local state to begin with.
function GoalList({ scope, goals }: { scope: "week" | "month"; goals: GoalRow[] }) {
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState("");
  const visible = goals.slice(0, 5);

  function submit() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    startTransition(async () => {
      await addGoalAction(scope, text).catch((err) => console.error("GoalsCard: addGoalAction failed", err));
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="rtd-micro-label">{scope === "week" ? "This week" : "This month"}</span>
      {visible.map((g) => (
        <div key={g.id} className="flex items-center gap-1.5">
          <button
            onClick={() =>
              startTransition(async () => {
                await toggleGoalAction(g.id).catch((err) => console.error("GoalsCard: toggleGoalAction failed", err));
              })
            }
            className="rtd-tap-target w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
            style={{
              background: g.done ? "var(--rtd-green)" : "transparent",
              border: g.done ? "none" : "1px solid var(--rtd-hairline)",
            }}
          >
            {g.done && <IconCheck size={11} />}
          </button>
          <span
            className="text-subhead flex-1 min-w-0 truncate"
            style={{
              color: g.done ? "var(--rtd-text-tertiary)" : "var(--rtd-text)",
              textDecoration: g.done ? "line-through" : "none",
            }}
          >
            {g.text}
          </span>
          <button
            aria-label="Move up"
            onClick={() =>
              startTransition(async () => {
                await reorderGoalAction(g.id, "up").catch((err) => console.error("GoalsCard: reorderGoalAction failed", err));
              })
            }
            className="rtd-tap-target text-caption text-[var(--rtd-text-tertiary)] px-1 shrink-0"
          >
            ↑
          </button>
          <button
            aria-label="Move down"
            onClick={() =>
              startTransition(async () => {
                await reorderGoalAction(g.id, "down").catch((err) => console.error("GoalsCard: reorderGoalAction failed", err));
              })
            }
            className="rtd-tap-target text-caption text-[var(--rtd-text-tertiary)] px-1 shrink-0"
          >
            ↓
          </button>
          <button
            aria-label="Delete goal"
            onClick={() =>
              startTransition(async () => {
                await deleteGoalAction(g.id).catch((err) => console.error("GoalsCard: deleteGoalAction failed", err));
              })
            }
            className="rtd-tap-target text-caption text-[var(--rtd-red)] px-1 shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
      {visible.length === 0 && <span className="text-caption text-[var(--rtd-text-tertiary)]">No goals yet.</span>}
      <div className="flex items-center gap-1.5 mt-0.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder={`Add a ${scope === "week" ? "weekly" : "monthly"} goal…`}
          className="flex-1 min-w-0 bg-transparent border-b border-[var(--rtd-hairline)] text-subhead text-[var(--rtd-text)] placeholder:text-[var(--rtd-text-tertiary)] focus:outline-none py-1"
        />
        <button onClick={submit} className="rtd-tap-target text-subhead text-[var(--rtd-blue)] px-1.5 shrink-0">
          Add
        </button>
      </div>
    </div>
  );
}

export function GoalsCard({ data, className }: { data: { week: GoalRow[]; month: GoalRow[] }; className?: string }) {
  return (
    <TerminalPanel label="05 // GOALS" colSpan={4} rowSpan={2} className={className}>
      <div className="flex flex-col gap-3.5">
        <GoalList scope="week" goals={data.week} />
        <GoalList scope="month" goals={data.month} />
      </div>
    </TerminalPanel>
  );
}
