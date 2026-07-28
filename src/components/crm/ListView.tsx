import { CrmTask } from "@/lib/crm/queries";
import { TaskCard } from "@/components/crm/TaskCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

const GROUP_ORDER: { value: CrmTask["urgency"]; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "someday", label: "Someday" },
];

/** Flat, sorted by priorityScore (already the query's own ORDER BY), grouped
 * by urgency with sticky headers. */
export function ListView({ tasks, onOpen }: { tasks: CrmTask[]; onOpen: (task: CrmTask) => void }) {
  const byGroup = new Map<CrmTask["urgency"], CrmTask[]>(GROUP_ORDER.map((g) => [g.value, []]));
  for (const t of tasks) byGroup.get(t.urgency)?.push(t);

  return (
    <div className="flex flex-col gap-4">
      {GROUP_ORDER.map((group) => {
        const groupTasks = byGroup.get(group.value) ?? [];
        if (groupTasks.length === 0) return null;
        return (
          <div key={group.value} className="flex flex-col gap-2">
            <div className="sticky top-0 z-10 -mx-3.5 px-3.5 py-1.5 backdrop-blur-md bg-[rgba(10,10,12,0.75)]">
              <SectionHeader
                title={group.label}
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
