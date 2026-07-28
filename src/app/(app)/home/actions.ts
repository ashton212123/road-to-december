"use server";

import { revalidatePath, updateTag } from "next/cache";
import { eq, and, lt, gt, desc, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { habits, habitLogs, goals } from "@/lib/db/schema";
import { todayManilaISO } from "@/lib/time";

/** Toggles one subtask on today's log for a habit, recomputing `completed`
 * from the full subtask set so ticking the last one auto-completes the
 * parent (§4a). Always resolves "today" itself via todayManilaISO() (§3.3)
 * rather than trusting a client-supplied date -- a tab left open across
 * midnight must never write to the wrong day. */
export async function toggleHabitSubtaskAction(habitId: number, subtaskId: string) {
  const today = todayManilaISO();

  const [habit] = await db.select({ subtasks: habits.subtasks }).from(habits).where(eq(habits.id, habitId));
  if (!habit) return;
  const totalSubtasks = habit.subtasks?.length ?? 0;

  const [existingLog] = await db
    .select({ doneSubtaskIds: habitLogs.doneSubtaskIds })
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.logDate, today)));

  const current = new Set(existingLog?.doneSubtaskIds ?? []);
  if (current.has(subtaskId)) current.delete(subtaskId);
  else current.add(subtaskId);
  const doneSubtaskIds = [...current];
  const completed = totalSubtasks > 0 && doneSubtaskIds.length >= totalSubtasks;

  await db
    .insert(habitLogs)
    .values({ habitId, logDate: today, doneSubtaskIds, completed })
    .onConflictDoUpdate({
      target: [habitLogs.habitId, habitLogs.logDate],
      set: { doneSubtaskIds, completed, updatedAt: new Date() },
    });

  revalidatePath("/home");
  updateTag("home-data");
}

export async function addGoalAction(scope: "week" | "month", text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;

  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${goals.sortOrder}), -1)` })
    .from(goals)
    .where(eq(goals.scope, scope));

  await db.insert(goals).values({ scope, text: trimmed, sortOrder: Number(maxOrder) + 1 });
  revalidatePath("/home");
  updateTag("home-data");
}

export async function toggleGoalAction(id: number) {
  const [goal] = await db.select({ done: goals.done }).from(goals).where(eq(goals.id, id));
  if (!goal) return;
  await db
    .update(goals)
    .set({ done: !goal.done, completedAt: !goal.done ? new Date() : null })
    .where(eq(goals.id, id));
  revalidatePath("/home");
  updateTag("home-data");
}

export async function deleteGoalAction(id: number) {
  await db.delete(goals).where(eq(goals.id, id));
  revalidatePath("/home");
  updateTag("home-data");
}

/** Swap-with-neighbor reorder within the same scope + done group -- Goals is
 * a compact 5-item Home card list, not a dedicated drag surface like the CRM
 * Kanban, so up/down swap is enough (no spec-mandated DnD here; logged as an
 * Assumption in PERSONAL_OS_LOG.md). */
export async function reorderGoalAction(id: number, direction: "up" | "down") {
  const [goal] = await db.select().from(goals).where(eq(goals.id, id));
  if (!goal) return;

  const neighbor = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.scope, goal.scope),
        eq(goals.done, goal.done),
        direction === "up" ? lt(goals.sortOrder, goal.sortOrder) : gt(goals.sortOrder, goal.sortOrder)
      )
    )
    .orderBy(direction === "up" ? desc(goals.sortOrder) : asc(goals.sortOrder))
    .limit(1);
  if (neighbor.length === 0) return;

  await db.update(goals).set({ sortOrder: neighbor[0].sortOrder }).where(eq(goals.id, goal.id));
  await db.update(goals).set({ sortOrder: goal.sortOrder }).where(eq(goals.id, neighbor[0].id));
  revalidatePath("/home");
  updateTag("home-data");
}
