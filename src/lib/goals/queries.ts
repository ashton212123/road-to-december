import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export type GoalRow = {
  id: number;
  scope: "week" | "month";
  text: string;
  done: boolean;
  sortOrder: number;
  createdAt: string;
  completedAt: string | null;
};

export type HomeGoalsData = {
  week: GoalRow[];
  month: GoalRow[];
};

const GOAL_COLUMNS = `
  id, scope, text, done, sort_order as "sortOrder",
  created_at as "createdAt", completed_at as "completedAt"
`;

/** One round trip for both scopes (§3.1). Undone goals first, then done
 * (persistent -- never auto-cleared, per spec Decision 10), each ordered by
 * sort_order within its done/undone group. Home slices the top 5 per scope
 * for display; every row is still returned so a completed/deleted goal
 * further down the list can surface. */
export async function getHomeGoalsData(): Promise<HomeGoalsData> {
  const rows = await db.execute(sql`
    select
      (select coalesce(json_agg(g), '[]') from (
        select ${sql.raw(GOAL_COLUMNS)}
        from goals
        where scope = 'week'
        order by done asc, sort_order asc
      ) g) as "week",

      (select coalesce(json_agg(g), '[]') from (
        select ${sql.raw(GOAL_COLUMNS)}
        from goals
        where scope = 'month'
        order by done asc, sort_order asc
      ) g) as "month"
  `);

  return rows[0] as unknown as HomeGoalsData;
}
