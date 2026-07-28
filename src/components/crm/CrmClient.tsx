"use client";

import { useEffect, useRef, useState } from "react";
import { CrmData, CrmTask } from "@/lib/crm/queries";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { KanbanView } from "@/components/crm/KanbanView";
import { ListView } from "@/components/crm/ListView";
import { CategoryView } from "@/components/crm/CategoryView";
import { ArchiveView } from "@/components/crm/ArchiveView";
import { TaskDrawer } from "@/components/crm/TaskDrawer";
import { deleteTaskAction } from "@/app/(app)/life/crm/actions";

type ViewMode = "kanban" | "list" | "category" | "archive";
const STORAGE_KEY = "crm-view-mode";
const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "kanban", label: "Kanban" },
  { value: "list", label: "List" },
  { value: "category", label: "Category" },
  { value: "archive", label: "Archive" },
];

const UNDO_WINDOW_MS = 5000;

export function CrmClient({ data }: { data: CrmData }) {
  // SSRs (and first client paint) as "kanban" so there's no hydration
  // mismatch, then reads the stored preference one tick later. The setState
  // is wrapped in setTimeout so it isn't a direct call in the effect body --
  // AGENTS.md §3.2's documented workaround for react-hooks/set-state-in-effect.
  const [view, setView] = useState<ViewMode>("kanban");
  const [drawerTask, setDrawerTask] = useState<CrmTask | null | "new">(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingDeleteTitle, setPendingDeleteTitle] = useState<string>("");
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "kanban" || stored === "list" || stored === "category" || stored === "archive") {
        setView(stored);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  function changeView(next: ViewMode) {
    setView(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  // Cancel any in-flight delete timer if the component unmounts mid-window.
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  function requestDelete(task: CrmTask) {
    setDrawerTask(null);
    setPendingDeleteId(task.id);
    setPendingDeleteTitle(task.title);
    deleteTimerRef.current = setTimeout(() => {
      deleteTaskAction(task.id).catch((err) => console.error(`CrmClient: delete failed for task ${task.id}`, err));
      setPendingDeleteId(null);
      deleteTimerRef.current = null;
    }, UNDO_WINDOW_MS);
  }

  function undoDelete() {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setPendingDeleteId(null);
  }

  const open = data.open.filter((t) => t.id !== pendingDeleteId);
  const archived = data.archived.filter((t) => t.id !== pendingDeleteId);

  const counts = { today: 0, week: 0, month: 0, someday: 0 };
  for (const t of open) counts[t.urgency]++;

  return (
    <div className="flex flex-col gap-3 pt-1">
      <div className="flex items-center justify-between gap-2">
        <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={changeView} className="flex-1" />
        <button
          type="button"
          onClick={() => setDrawerTask("new")}
          aria-label="New task"
          className="rtd-tap-target shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.08] text-headline cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
        >
          +
        </button>
      </div>

      <div className="flex items-center gap-3 text-caption-1 text-[var(--rtd-text-tertiary)] px-1">
        <span><span className="rtd-nums rtd-mono">{counts.today}</span> today</span>
        <span><span className="rtd-nums rtd-mono">{counts.week}</span> this week</span>
        <span><span className="rtd-nums rtd-mono">{counts.month}</span> this month</span>
        <span><span className="rtd-nums rtd-mono">{counts.someday}</span> someday</span>
      </div>

      {view === "kanban" && (open.length === 0 ? (
        <EmptyState icon="✓" title="Nothing open" body="Add a task or capture one." />
      ) : (
        <KanbanView tasks={open} onOpen={setDrawerTask} />
      ))}
      {view === "list" && (open.length === 0 ? (
        <EmptyState icon="✓" title="Nothing open" body="Add a task or capture one." />
      ) : (
        <ListView tasks={open} onOpen={setDrawerTask} />
      ))}
      {view === "category" && (open.length === 0 ? (
        <EmptyState icon="✓" title="Nothing open" body="Add a task or capture one." />
      ) : (
        <CategoryView tasks={open} onOpen={setDrawerTask} />
      ))}
      {view === "archive" && <ArchiveView tasks={archived} onOpen={setDrawerTask} />}

      {drawerTask !== null && (
        <TaskDrawer
          task={drawerTask === "new" ? null : drawerTask}
          onClose={() => setDrawerTask(null)}
          onRequestDelete={requestDelete}
        />
      )}

      {pendingDeleteId !== null && (
        <Toast message={`Deleted "${pendingDeleteTitle}"`} actionLabel="Undo" onAction={undoDelete} />
      )}
    </div>
  );
}
