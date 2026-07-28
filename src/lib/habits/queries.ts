import { sql, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { habits } from "@/lib/db/schema";
import type { Habit } from "@/lib/db/schema";

export type HabitSubtask = { id: string; label: string };

export type HabitWithTodayLog = {
  id: number;
  name: string;
  category: string;
  sortOrder: number;
  subtasks: HabitSubtask[];
  doneSubtaskIds: string[];
  completed: boolean;
};

export type HabitDailyCompletion = {
  date: string;
  completedCount: number;
  loggedCount: number;
};

export type HomeHabitsData = {
  habits: HabitWithTodayLog[];
  dailyCompletion: HabitDailyCompletion[];
};

/** One round trip for the whole habits card (§3.1): today's active habits
 * joined to today's log row, plus a 30-day completion window the client
 * turns into a DotStrip. `today`/`windowStartISO` both come from
 * todayManilaISO()/addDaysISO() at the call site -- this file never computes
 * a date itself (§3.3). */
export async function getHomeHabitsData(today: string, windowStartISO: string): Promise<HomeHabitsData> {
  const rows = await db.execute(sql`
    select
      (select coalesce(json_agg(h), '[]') from (
        select
          hb.id, hb.name, hb.category, hb.sort_order as "sortOrder", hb.subtasks,
          coalesce(hl.done_subtask_ids, '{}') as "doneSubtaskIds",
          coalesce(hl.completed, false) as "completed"
        from habits hb
        left join habit_logs hl on hl.habit_id = hb.id and hl.log_date = ${today}
        where hb.active = true
        order by hb.sort_order
      ) h) as "habits",

      (select coalesce(json_agg(d), '[]') from (
        select
          hl.log_date::text as "date",
          count(*) filter (where hl.completed) as "completedCount",
          count(*) as "loggedCount"
        from habit_logs hl
        where hl.log_date >= ${windowStartISO} and hl.log_date <= ${today}
        group by hl.log_date
      ) d) as "dailyCompletion"
  `);

  return rows[0] as unknown as HomeHabitsData;
}

/** Settings' habit editor needs every habit, active or archived -- unlike
 * the Home card, which only ever sees the active set. */
export async function getAllHabitsForEditor(): Promise<Habit[]> {
  return db.select().from(habits).orderBy(asc(habits.sortOrder));
}
