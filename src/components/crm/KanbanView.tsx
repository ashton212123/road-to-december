"use client";

import { useState, useTransition } from "react";
import { CrmTask } from "@/lib/crm/queries";
import { TaskCard } from "@/components/crm/TaskCard";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { reorderTaskAction } from "@/app/(app)/life/crm/actions";

type Urgency = "today" | "week" | "month" | "someday";

const COLUMNS: { value: Urgency; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "someday", label: "Someday" },
];

/**
 * Desktop-only drag (native HTML5 DnD -- `draggable` is inert on touch
 * without a polyfill, which we deliberately don't add, so this degrades to
 * "no drag" on mobile automatically, per spec). Mobile reorders via the
 * drawer's urgency SegmentedControl instead (TaskDrawer.tsx).
 *
 * No local optimistic reorder state -- the rendered list is always exactly
 * `tasks` from props. A drag drop calls the server action and waits for
 * revalidation to bring the new order back down, rather than keeping a
 * separate client copy that a later unrelated prop update could clobber
 * (the mount-time-GET-vs-fresh-edit bug class from AGENTS.md §3.7).
 */
export function KanbanView({ tasks, onOpen }: { tasks: CrmTask[]; onOpen: (task: CrmTask) => void }) {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ column: Urgency; beforeId: number | null; afterId: number | null } | null>(null);
  const [, startReorder] = useTransition();

  const byColumn = new Map<Urgency, CrmTask[]>(COLUMNS.map((c) => [c.value, []]));
  for (const t of tasks) byColumn.get(t.urgency)?.push(t);

  function handleDragOverCard(e: React.DragEvent, column: Urgency, card: CrmTask, columnTasks: CrmTask[]) {
    e.preventDefault();
    if (draggedId === null || draggedId === card.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isAboveMidpoint = e.clientY < rect.top + rect.height / 2;
    const idx = columnTasks.findIndex((t) => t.id === card.id);
    if (isAboveMidpoint) {
      const prev = columnTasks[idx - 1];
      setDropTarget({ column, beforeId: prev && prev.id !== draggedId ? prev.id : null, afterId: card.id });
    } else {
      const next = columnTasks[idx + 1];
      setDropTarget({ column, beforeId: card.id, afterId: next && next.id !== draggedId ? next.id : null });
    }
  }

  function handleDragOverColumn(e: React.DragEvent, column: Urgency, columnTasks: CrmTask[]) {
    e.preventDefault();
    if (draggedId === null) return;
    if (columnTasks.length === 0 || columnTasks.every((t) => t.id === draggedId)) {
      setDropTarget({ column, beforeId: null, afterId: null });
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (draggedId === null || !dropTarget) return;
    const taskId = draggedId;
    const target = dropTarget;
    setDraggedId(null);
    setDropTarget(null);
    startReorder(async () => {
      await reorderTaskAction({ taskId, urgency: target.column, beforeId: target.beforeId, afterId: target.afterId });
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {COLUMNS.map((col) => {
        const columnTasks = byColumn.get(col.value) ?? [];
        return (
          <TerminalPanel
            key={col.value}
            onDragOver={(e) => handleDragOverColumn(e, col.value, columnTasks)}
            onDrop={handleDrop}
            padding="sm"
            className="min-h-[120px]"
            label={col.label}
            statusChip={<span className="rtd-mono text-[11px] md:text-xs text-[var(--rtd-text-tertiary)]">{columnTasks.length}</span>}
          >
            <div className="flex flex-col gap-2">
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  onDragOver={(e) => handleDragOverCard(e, col.value, task, columnTasks)}
                >
                  {dropTarget?.column === col.value && dropTarget.beforeId === null && dropTarget.afterId === task.id && (
                    <div className="h-0.5 rounded-full mb-1" style={{ background: "var(--rtd-blue)" }} />
                  )}
                  <TaskCard
                    task={task}
                    onOpen={() => onOpen(task)}
                    draggable
                    dragging={draggedId === task.id}
                    onDragStart={(e) => {
                      setDraggedId(task.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedId(null);
                      setDropTarget(null);
                    }}
                  />
                  {dropTarget?.column === col.value && dropTarget.afterId === null && dropTarget.beforeId === task.id && (
                    <div className="h-0.5 rounded-full mt-1" style={{ background: "var(--rtd-blue)" }} />
                  )}
                </div>
              ))}
              {columnTasks.length === 0 && (
                <div className="text-caption-1 text-[var(--rtd-text-tertiary)] text-center py-4">Nothing here</div>
              )}
            </div>
          </TerminalPanel>
        );
      })}
    </div>
  );
}
