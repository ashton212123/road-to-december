import { CrmTask } from "@/lib/crm/queries";
import { TaskCard } from "@/components/crm/TaskCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Bucket, BUCKET_COLUMNS, BUCKET_DOT_COLOR, bucketFor } from "@/lib/crm/buckets";
import { todayManilaISO } from "@/lib/time";

/** Flat, sorted by priorityScore (already the query's own ORDER BY), grouped
 * into the same OVERDUE/TODAY/THIS WEEK/LATER buckets as KanbanView (WS3d
 * §10) rather than the raw urgency tiers -- one bucketing scheme across both
 * views, so a task's group is consistent between Kanban and List. */
export function ListView({ tasks, onOpen }: { tasks: CrmTask[]; onOpen: (task: CrmTask) => void }) {
  const today = todayManilaISO();
  const byGroup = new Map<Bucket, CrmTask[]>(BUCKET_COLUMNS.map((g) => [g.value, []]));
  for (const t of tasks) byGroup.get(bucketFor(t, today))?.push(t);

  return (
    <div className="flex flex-col gap-4">
      {BUCKET_COLUMNS.map((group) => {
        const groupTasks = byGroup.get(group.value) ?? [];
        if (groupTasks.length === 0) return null;
        return (
          <div key={group.value} className="flex flex-col gap-2">
            <div className="sticky top-0 z-10 -mx-3.5 px-3.5 py-1.5 backdrop-blur-md bg-[rgba(10,10,12,0.75)]">
              <SectionHeader
                title={group.label}
                dotColor={BUCKET_DOT_COLOR[group.value]}
                statusChip={<span className="rtd-mono text-[11px] md:text-xs text-[var(--rtd-text-tertiary)]">{groupTasks.length}</span>}
              />
            </div>
            <div className="flex flex-col gap-2">
              {groupTasks.map((task) => (
                <TaskCard key={task.id} task={task} onOpen={() => onOpen(task)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
