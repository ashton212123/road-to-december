"use server";

import { eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/lib/db";
import { tasks, businessTasks } from "@/lib/db/schema";
import { topOfTierScore, interpolateScore } from "@/lib/crm/priority";

type Urgency = "today" | "week" | "month" | "someday";

function revalidateCrm() {
  revalidatePath("/life/crm");
  updateTag("home-data");
}

async function maxScoreInTier(urgency: Urgency): Promise<number | null> {
  const rows = await db.execute(sql`select max(priority_score) as "max" from tasks where urgency = ${urgency} and completed_at is null`);
  return (rows[0] as { max: number | null }).max;
}

export async function createTaskAction(input: {
  title: string;
  notes?: string | null;
  urgency: Urgency;
  rail: "life" | "athlete";
  category?: string | null;
  dueDate?: string | null;
  timeEstimateMin?: number | null;
  tags?: string[] | null;
}) {
  const priorityScore = topOfTierScore(input.urgency, await maxScoreInTier(input.urgency));
  const [created] = await db
    .insert(tasks)
    .values({
      title: input.title,
      notes: input.notes ?? null,
      urgency: input.urgency,
      rail: input.rail,
      category: input.category ?? null,
      dueDate: input.dueDate ?? null,
      timeEstimateMin: input.timeEstimateMin ?? null,
      tags: input.tags ?? null,
      isKey: false,
      priorityScore,
      sourceKind: "manual",
    })
    .returning();
  revalidateCrm();
  return created;
}

/** Title/notes are ignored for mirrored (business/canvas) rows -- they stay
 * read-only from their source, per spec. Every other field is editable on
 * any task, mirrored or manual. */
export async function updateTaskAction(
  id: number,
  patch: {
    title?: string;
    notes?: string | null;
    dueDate?: string | null;
    timeEstimateMin?: number | null;
    tags?: string[] | null;
    category?: string | null;
  }
) {
  const [existing] = await db.select({ sourceKind: tasks.sourceKind }).from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!existing) return;

  const safePatch = { ...patch };
  if (existing.sourceKind !== "manual") {
    delete safePatch.title;
    delete safePatch.notes;
  }
  if (Object.keys(safePatch).length === 0) return;

  await db
    .update(tasks)
    .set({ ...safePatch, updatedAt: new Date() })
    .where(eq(tasks.id, id));
  revalidateCrm();
}

/** For business-sourced tasks, calls back through business_tasks.done so the
 * Business tab stays authoritative (spec §3c). Canvas assignments have no
 * local completion concept to write back to -- see mirror.ts's header
 * comment -- so canvas-sourced tasks only ever update their own completedAt. */
export async function completeTaskAction(id: number) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task || task.completedAt) return;

  await db
    .update(tasks)
    .set({ completedAt: new Date(), updatedAt: new Date() })
    .where(eq(tasks.id, id));

  if (task.sourceKind === "business" && task.sourceId) {
    await db.update(businessTasks).set({ done: true }).where(eq(businessTasks.id, Number(task.sourceId)));
  }
  revalidateCrm();
}

export async function uncompleteTaskAction(id: number) {
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task || !task.completedAt) return;

  await db
    .update(tasks)
    .set({ completedAt: null, updatedAt: new Date() })
    .where(eq(tasks.id, id));

  if (task.sourceKind === "business" && task.sourceId) {
    await db.update(businessTasks).set({ done: false }).where(eq(businessTasks.id, Number(task.sourceId)));
  }
  revalidateCrm();
}

/** Mirrored rows aren't deletable this way -- they keep living in their own
 * table (spec §Decision 8); deleting them here would just have the next
 * mirror sync recreate them, which reads as broken rather than intentional.
 * No-ops silently on a mirrored id rather than throwing, since the UI never
 * offers this action for a mirrored task in the first place. */
export async function deleteTaskAction(id: number) {
  const [task] = await db.select({ sourceKind: tasks.sourceKind }).from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!task) return;
  if (task.sourceKind !== "manual" && task.sourceKind !== "capture") return;

  await db.delete(tasks).where(eq(tasks.id, id));
  revalidateCrm();
}

export async function toggleKeyAction(id: number, isKey: boolean) {
  await db
    .update(tasks)
    .set({ isKey, updatedAt: new Date() })
    .where(eq(tasks.id, id));
  revalidateCrm();
}

/** Quick-action urgency change (not a drag) -- inserts at the top of the new tier. */
export async function setUrgencyAction(id: number, urgency: Urgency) {
  const priorityScore = topOfTierScore(urgency, await maxScoreInTier(urgency));
  await db
    .update(tasks)
    .set({ urgency, priorityScore, updatedAt: new Date() })
    .where(eq(tasks.id, id));
  revalidateCrm();
}

/** Kanban drag: `beforeId`/`afterId` are the tasks immediately above/below
 * the drop position in the target column (null at the very top/bottom).
 * Interpolates a priority_score between them so the drop lands exactly where
 * it visually was dropped. */
export async function reorderTaskAction(input: {
  taskId: number;
  urgency: Urgency;
  beforeId: number | null;
  afterId: number | null;
}) {
  const neighborIds = [input.beforeId, input.afterId].filter((id): id is number => id !== null);
  const neighbors = neighborIds.length
    ? await db.select({ id: tasks.id, score: tasks.priorityScore }).from(tasks).where(inArray(tasks.id, neighborIds))
    : [];
  const aboveScore = input.beforeId !== null ? (neighbors.find((n) => n.id === input.beforeId)?.score ?? null) : null;
  const belowScore = input.afterId !== null ? (neighbors.find((n) => n.id === input.afterId)?.score ?? null) : null;
  const priorityScore = interpolateScore(aboveScore, belowScore);

  await db
    .update(tasks)
    .set({ urgency: input.urgency, priorityScore, updatedAt: new Date() })
    .where(eq(tasks.id, input.taskId));
  revalidateCrm();
}
