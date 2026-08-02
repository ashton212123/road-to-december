"use client";

import { useState, useTransition } from "react";
import { CrmTask } from "@/lib/crm/queries";
import { TaskCard } from "@/components/crm/TaskCard";
import { Bucket, BUCKET_COLUMNS, BUCKET_DOT_COLOR, bucketFor } from "@/lib/crm/buckets";
import { todayManilaISO } from "@/lib/time";
import { reorderTaskAction } from "@/app/(app)/life/crm/actions";

type Urgency = "today" | "week" | "month" | "someday";

/** Kanban's 4 board columns are OVERDUE/TODAY/THIS WEEK/LATER (derived
 * buckets, see lib/crm/buckets.ts), but a drop only ever sets `urgency` --
 * overdue isn't a settable state, and LATER maps to 'someday' on drop
 * (the user-approved mapping folds month+someday into LATER for display;
 * 'month' stays reachable from the task drawer's own urgency control). */
const DROP_URGENCY: Partial<Record<Bucket, Urgency>> = { today: "today", week: "week", later: "someday" };

function ColumnHeaderRow({ label, dotColor, count }: { label: string; dotColor: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0 flex-1">
      <span aria-hidden="true" className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: dotColor }} />
      <span
        className="uppercase whitespace-nowrap"
        style={{ font: "500 var(--rtd-mos-fs-section)/1 var(--rtd-font-mono)", letterSpacing: "var(--rtd-mos-ls-section)", color: "var(--rtd-mos-fg-3)" }}
      >
        {label}
      </span>
      <span className="rtd-mono ml-auto shrink-0" style={{ font: "400 var(--rtd-mos-fs-micro)/1 var(--rtd-font-mono)", color: "var(--rtd-mos-fg-dimmer)" }}>
        {count}
      </span>
    </div>
  );
}

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
  const [dropTarget, setDropTarget] = useState<{ column: Bucket; beforeId: number | null; afterId: number | null } | null>(null);
  const [, startReorder] = useTransition();

  const today = todayManilaISO();
  const byColumn = new Map<Bucket, CrmTask[]>(BUCKET_COLUMNS.map((c) => [c.value, []]));
  for (const t of tasks) byColumn.get(bucketFor(t, today))?.push(t);

  function handleDragOverCard(e: React.DragEvent, column: Bucket, card: CrmTask, columnTasks: CrmTask[]) {
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

  function handleDragOverColumn(e: React.DragEvent, column: Bucket, columnTasks: CrmTask[]) {
    if (!DROP_URGENCY[column]) return; // OVERDUE is derived, not a valid drop target
    e.preventDefault();
    if (draggedId === null) return;
    if (columnTasks.length === 0 || columnTasks.every((t) => t.id === draggedId)) {
      setDropTarget({ column, beforeId: null, afterId: null });
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (draggedId === null || !dropTarget) return;
    const urgency = DROP_URGENCY[dropTarget.column];
    if (!urgency) return;
    const taskId = draggedId;
    const target = dropTarget;
    setDraggedId(null);
    setDropTarget(null);
    startReorder(async () => {
      await reorderTaskAction({ taskId, urgency, beforeId: target.beforeId, afterId: target.afterId });
    });
  }

  return (
    <div className="flex flex-col gap-2 lg:grid lg:grid-cols-4 lg:gap-3.5">
      {BUCKET_COLUMNS.map((col) => {
        const columnTasks = byColumn.get(col.value) ?? [];
        const dotColor = BUCKET_DOT_COLOR[col.value];
        const canDrop = Boolean(DROP_URGENCY[col.value]);
        return (
          <details key={col.value} open={col.value === "overdue"} className="lg:contents">
            <summary className="lg:hidden rtd-tap-target cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden py-2 px-0.5">
              <ColumnHeaderRow label={col.label} dotColor={dotColor} count={columnTasks.length} />
            </summary>
            <div
              onDragOver={canDrop ? (e) => handleDragOverColumn(e, col.value, columnTasks) : undefined}
              onDrop={canDrop ? handleDrop : undefined}
              className="min-w-0 min-h-[80px] lg:min-h-[120px]"
            >
              <div className="hidden lg:block pb-2.5 px-0.5" style={{ borderBottom: "1px solid var(--rtd-hairline)" }}>
                <ColumnHeaderRow label={col.label} dotColor={dotColor} count={columnTasks.length} />
              </div>
              <div className="flex flex-col gap-2.5 mt-2.5">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    onDragOver={canDrop ? (e) => handleDragOverCard(e, col.value, task, columnTasks) : undefined}
                  >
                    {dropTarget?.column === col.value && dropTarget.beforeId === null && dropTarget.afterId === task.id && (
                      <div className="h-0.5 rounded-full mb-1" style={{ background: "var(--rtd-blue)" }} />
                    )}
                    <TaskCard
                      task={task}
                      onOpen={() => onOpen(task)}
                      surface="panel2"
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
            </div>
          </details>
        );
      })}
    </div>
  );
}
