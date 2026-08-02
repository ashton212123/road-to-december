import { CrmTask } from "@/lib/crm/queries";
import { daysBetween } from "@/lib/time";

export type Bucket = "overdue" | "today" | "week" | "later";

export const BUCKET_COLUMNS: { value: Bucket; label: string }[] = [
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "later", label: "Later" },
];

/** MILES-OS-UI-SPEC.md's CRM board: OVERDUE / TODAY / THIS WEEK / LATER.
 * Derived, not stored -- tasks.urgency (schema.ts) only has
 * today/week/month/someday, so overdue comes from dueDate and LATER folds
 * month+someday into one column (user-approved mapping, WS3d §10). Overdue
 * takes priority over urgency: a 'week' task with a lapsed due date shows in
 * OVERDUE, not THIS WEEK, until its due date changes (in the drawer) or it's
 * completed -- dragging it to another Kanban column alone won't clear it. */
export function bucketFor(task: Pick<CrmTask, "urgency" | "dueDate">, today: string): Bucket {
  if (task.dueDate && daysBetween(today, task.dueDate) < 0) return "overdue";
  if (task.urgency === "today") return "today";
  if (task.urgency === "week") return "week";
  return "later";
}

/** Existing --rtd-mos-* tokens only (no new hex) -- nearest semantic match
 * to the reference kit's per-column dot colors (Miles OS UI Kit.html, CRM
 * screen): overdue reuses the HOT-badge red, today the WARM amber, week the
 * primary blue, later the dimmest fg tone. */
export const BUCKET_DOT_COLOR: Record<Bucket, string> = {
  overdue: "var(--rtd-mos-red)",
  today: "var(--rtd-mos-amber)",
  week: "var(--rtd-mos-blue)",
  later: "var(--rtd-mos-fg-3)",
};
