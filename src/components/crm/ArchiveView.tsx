import { CrmTask } from "@/lib/crm/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { TerminalPanel } from "@/components/ui/TerminalPanel";

/** Completed tasks, most-recently-completed first (queries.ts already orders
 * this way). Lighter-weight row, not the full TaskCard -- archive is a
 * read-mostly view, tapping still opens the drawer to reopen/inspect. */
export function ArchiveView({ tasks, onOpen }: { tasks: CrmTask[]; onOpen: (task: CrmTask) => void }) {
  if (tasks.length === 0) {
    return <EmptyState icon="✓" title="Nothing archived yet" body="Completed tasks land here." />;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {tasks.map((task) => (
        <TerminalPanel
          key={task.id}
          variant="open"
          interactive
          fill={false}
          padding="sm"
          onClick={() => onOpen(task)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onOpen(task);
            }
          }}
          ariaLabel={task.title}
          className="text-left"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[var(--rtd-green)] shrink-0">✓</span>
            <span className="flex-1 min-w-0 text-subhead text-[var(--rtd-text-secondary)] truncate line-through">{task.title}</span>
            {task.completedAt && (
              <span className="text-caption-1 rtd-mono text-[var(--rtd-text-tertiary)] shrink-0">
                {new Date(task.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </TerminalPanel>
      ))}
    </div>
  );
}
