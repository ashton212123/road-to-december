import { daysBetween, todayManilaISO } from "@/lib/time";

const URGENCY_BASE: Record<"today" | "week" | "month" | "someday", number> = {
  today: 3000,
  week: 2000,
  month: 1000,
  someday: 0,
};

const KEY_BONUS = 500;

/**
 * Default ranking within a tier: key tasks float up, closer due dates float
 * up, older tasks nudge up slightly so nothing sits forgotten forever.
 * Manual drag reordering (see interpolateScore below) overrides this per-task
 * afterwards -- this is only the starting point for new/re-tiered tasks.
 */
export function computePriorityScore(task: {
  urgency: "today" | "week" | "month" | "someday";
  isKey: boolean;
  dueDate: string | null;
  createdAt: Date | string;
}): number {
  let score = URGENCY_BASE[task.urgency];
  if (task.isKey) score += KEY_BONUS;

  if (task.dueDate) {
    const daysUntil = daysBetween(todayManilaISO(), task.dueDate);
    score += Math.max(0, 200 - daysUntil * 5);
  }

  const createdISO =
    typeof task.createdAt === "string" ? task.createdAt.slice(0, 10) : task.createdAt.toISOString().slice(0, 10);
  const ageDays = Math.max(0, daysBetween(createdISO, todayManilaISO()));
  score += Math.min(ageDays * 2, 100);

  return score;
}

/**
 * Score for a manual drag-drop reorder: interpolates between the two
 * neighbors' current scores at the drop index. Top-of-list and
 * bottom-of-list are handled by padding above/below by a fixed step so
 * repeated drops to the very top/bottom keep making room instead of
 * converging on the neighbor's score.
 */
export function interpolateScore(neighborAbove: number | null, neighborBelow: number | null): number {
  if (neighborAbove === null && neighborBelow === null) return URGENCY_BASE.today;
  if (neighborAbove === null) return neighborBelow! + 100;
  if (neighborBelow === null) return neighborAbove - 100;
  return (neighborAbove + neighborBelow) / 2;
}

/** Score for "insert at the top of this tier" (new task, or urgency changed via quick-action). */
export function topOfTierScore(urgency: "today" | "week" | "month" | "someday", currentMaxInTier: number | null): number {
  if (currentMaxInTier === null) return URGENCY_BASE[urgency] + KEY_BONUS + 200;
  return currentMaxInTier + 100;
}
