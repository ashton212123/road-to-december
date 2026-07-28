import { CrmTask } from "@/lib/crm/queries";
import { TaskCard } from "@/components/crm/TaskCard";
import { SectionHeader } from "@/components/ui/SectionHeader";

const RAIL_LABEL: Record<CrmTask["rail"], string> = { life: "Life", athlete: "Athlete" };

/** Grouped by category, then by rail for uncategorized tasks -- category is
 * the more specific grouping (e.g. a business name or course name) so it
 * takes priority; tasks with no category fall back to their rail. */
export function CategoryView({ tasks, onOpen }: { tasks: CrmTask[]; onOpen: (task: CrmTask) => void }) {
  const groups = new Map<string, CrmTask[]>();
  for (const t of tasks) {
    const key = t.category ?? `${RAIL_LABEL[t.rail]} (uncategorized)`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  const sortedKeys = [...groups.keys()].sort((a, b) => groups.get(b)!.length - groups.get(a)!.length);

  if (sortedKeys.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {sortedKeys.map((key) => (
        <div key={key} className="flex flex-col gap-2">
          <div className="sticky top-0 z-10 -mx-3.5 px-3.5 py-1.5 backdrop-blur-md bg-[rgba(10,10,12,0.75)]">
            <SectionHeader
              title={key}
              statusChip={<span className="rtd-mono text-[11px] md:text-xs text-[var(--rtd-text-tertiary)]">{groups.get(key)!.length}</span>}
            />
          </div>
          <div className="flex flex-col gap-2">
            {groups.get(key)!.map((task) => (
              <TaskCard key={task.id} task={task} onOpen={() => onOpen(task)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
