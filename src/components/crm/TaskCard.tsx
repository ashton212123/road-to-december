import { CrmTask } from "@/lib/crm/queries";
import { daysBetween, todayManilaISO } from "@/lib/time";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { StatusChip } from "@/components/ui/StatusChip";

const SOURCE_LABEL: Record<CrmTask["sourceKind"], string | null> = {
  manual: null,
  capture: null,
  business: "Business",
  canvas: "Canvas",
};

function dueBadge(dueDate: string | null): { text: string; danger: boolean } | null {
  if (!dueDate) return null;
  const days = daysBetween(todayManilaISO(), dueDate);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, danger: true };
  if (days === 0) return { text: "Due today", danger: true };
  if (days === 1) return { text: "Due tomorrow", danger: false };
  return { text: `Due in ${days}d`, danger: false };
}

export function TaskCard({
  task,
  onOpen,
  draggable = false,
  onDragStart,
  onDragEnd,
  dragging = false,
}: {
  task: CrmTask;
  onOpen: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  dragging?: boolean;
}) {
  const due = dueBadge(task.dueDate);
  const sourceLabel = SOURCE_LABEL[task.sourceKind];

  return (
    <TerminalPanel
      variant="open"
      interactive
      fill={false}
      padding="sm"
      gap="sm"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
      style={{ opacity: dragging ? 0.4 : 1 }}
    >
      <div className="flex items-start gap-2">
        <span className="flex-1 min-w-0 text-subhead font-medium text-[var(--rtd-text)] break-words">{task.title}</span>
        {task.isKey && (
          <span className="shrink-0 text-[var(--rtd-purple)]" aria-label="Key task" title="Key task">
            ★
          </span>
        )}
      </div>
      {(sourceLabel || task.category || due) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {sourceLabel && (
            <span className="text-caption-1 px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[var(--rtd-text-tertiary)]">
              {sourceLabel}
            </span>
          )}
          {task.category && (
            <span className="text-caption-1 px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[var(--rtd-text-tertiary)] truncate max-w-[10rem]">
              {task.category}
            </span>
          )}
          {due && <StatusChip label={due.text} tone={due.danger ? "danger" : "neutral"} />}
        </div>
      )}
    </TerminalPanel>
  );
}
