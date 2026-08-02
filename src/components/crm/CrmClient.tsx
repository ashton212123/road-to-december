"use client";

import { useEffect, useRef, useState } from "react";
import { CrmData, CrmTask } from "@/lib/crm/queries";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { KanbanView } from "@/components/crm/KanbanView";
import { ListView } from "@/components/crm/ListView";
import { CategoryView } from "@/components/crm/CategoryView";
import { ArchiveView } from "@/components/crm/ArchiveView";
import { TaskDrawer } from "@/components/crm/TaskDrawer";
import { BUCKET_COLUMNS, BUCKET_DOT_COLOR, bucketFor } from "@/lib/crm/buckets";
import { todayManilaISO } from "@/lib/time";
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

  const today = todayManilaISO();
  const bucketCounts = { overdue: 0, today: 0, week: 0, later: 0 };
  for (const t of open) bucketCounts[bucketFor(t, today)]++;

  return (
    <div className="flex flex-col gap-3 pt-1">
      {/* Filter bar panel (MILES-OS-UI-SPEC.md's CRM screen: "filter bar
          panel, then board panel..."). RTD has no per-type filters like the
          reference kit's People/Tasks/Content pills -- this row carries the
          view toggle, add button, and the same OVERDUE/TODAY/THIS
          WEEK/LATER buckets KanbanView/ListView group by, so the count here
          always matches what's behind each toggle. */}
      <TerminalPanel padding="sm" gap="sm">
        <div className="flex items-center justify-between gap-2">
          <SegmentedControl options={VIEW_OPTIONS} value={view} onChange={changeView} className="flex-1" />
          <button
            type="button"
            onClick={() => setDrawerTask("new")}
            aria-label="New task"
            className="rtd-tap-target shrink-0 w-10 h-10 rounded-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
            style={{
              background: "color-mix(in srgb, var(--rtd-mos-blue) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--rtd-mos-blue) 22%, transparent)",
              color: "var(--rtd-mos-blue)",
            }}
          >
            +
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap px-0.5">
          {BUCKET_COLUMNS.map((b) => (
            <span key={b.value} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: BUCKET_DOT_COLOR[b.value] }} />
              <span className="rtd-nums rtd-mono text-caption-1 text-[var(--rtd-text-tertiary)]">{bucketCounts[b.value]}</span>
              <span className="text-caption-1 text-[var(--rtd-text-tertiary)]">{b.label.toLowerCase()}</span>
            </span>
          ))}
        </div>
      </TerminalPanel>

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
