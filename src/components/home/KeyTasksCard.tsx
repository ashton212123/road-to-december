import { TerminalPanel } from "@/components/ui/TerminalPanel";
import type { KeyTask } from "@/lib/crm/queries";

const URGENCY_LABEL: Record<KeyTask["urgency"], string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  someday: "Someday",
};

/** `06 // KEY TASKS` -- the ★-starred, ranked slice of the CRM (Phase 3),
 * surfaced on Home so the highest-priority items across both rails are
 * visible without a trip to /life/crm. */
export function KeyTasksCard({ tasks, className }: { tasks: KeyTask[]; className?: string }) {
  return (
    <TerminalPanel href="/life/crm" label="06 // KEY TASKS" colSpan={4} className={className}>
      {tasks.length === 0 ? (
        <span className="text-caption text-[var(--rtd-text-tertiary)]">No starred tasks</span>
      ) : (
        <div className="flex flex-col rtd-divide-y">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
              <span aria-hidden="true" className="text-[var(--rtd-yellow)] shrink-0">
                ★
              </span>
              <span className="flex-1 min-w-0 text-subhead text-[var(--rtd-text)] truncate">{t.title}</span>
              <span className="shrink-0 text-caption text-[var(--rtd-text-tertiary)]">{URGENCY_LABEL[t.urgency]}</span>
            </div>
          ))}
        </div>
      )}
    </TerminalPanel>
  );
}
