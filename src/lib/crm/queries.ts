import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type CrmTask = {
  id: number;
  title: string;
  notes: string | null;
  urgency: "today" | "week" | "month" | "someday";
  isKey: boolean;
  priorityScore: number;
  timeEstimateMin: number | null;
  tags: string[] | null;
  dueDate: string | null;
  rail: "life" | "athlete";
  category: string | null;
  sourceKind: "manual" | "capture" | "business" | "canvas";
  sourceId: string | null;
  captureId: number | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrmData = {
  open: CrmTask[];
  archived: CrmTask[];
};

const TASK_COLUMNS = `
  id, title, notes, urgency, is_key as "isKey", priority_score as "priorityScore",
  time_estimate_min as "timeEstimateMin", tags, due_date as "dueDate", rail, category,
  source_kind as "sourceKind", source_id as "sourceId", capture_id as "captureId",
  completed_at as "completedAt", created_at as "createdAt", updated_at as "updatedAt"
`;

/** One round trip for the whole CRM page: every open task plus a recent
 * slice of the archive (§3.1 -- batched, not N queries). Tier counts are
 * cheap to derive client-side from `open`, so there's no separate count query. */
export async function getCrmData(): Promise<CrmData> {
  const rows = await db.execute(sql`
    select
      (select coalesce(json_agg(t), '[]') from (
        select ${sql.raw(TASK_COLUMNS)}
        from tasks
        where completed_at is null
        order by priority_score desc, created_at desc
      ) t) as "open",

      (select coalesce(json_agg(t), '[]') from (
        select ${sql.raw(TASK_COLUMNS)}
        from tasks
        where completed_at is not null
        order by completed_at desc
        limit 200
      ) t) as "archived"
  `);

  return rows[0] as unknown as CrmData;
}

export type KeyTask = { id: number; title: string; urgency: CrmTask["urgency"]; dueDate: string | null; rail: CrmTask["rail"] };

/** Home's `06 // KEY TASKS` needs only the small ★-starred slice, not the
 * full CRM dataset getCrmData batches -- a lightweight dedicated query
 * (one round trip) rather than over-fetching the whole open+archived set. */
export async function getHomeKeyTasks(limit = 5): Promise<KeyTask[]> {
  const rows = await db.execute(sql`
    select id, title, urgency, due_date as "dueDate", rail
    from tasks
    where is_key = true and completed_at is null
    order by priority_score desc, created_at desc
    limit ${limit}
  `);
  return rows as unknown as KeyTask[];
}
