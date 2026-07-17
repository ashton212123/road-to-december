export type AttentionDomain = "train" | "swim" | "fuel" | "recovery" | "business" | "school";

export type AttentionItem = {
  id: string;
  domain: AttentionDomain;
  label: string;
  detail?: string;
  href: string;
  urgent: boolean;
};

export const DOMAIN_META: Record<AttentionDomain, { label: string; color: string }> = {
  train: { label: "Train", color: "var(--rtd-blue)" },
  swim: { label: "Swim", color: "var(--rtd-cyan)" },
  fuel: { label: "Fuel", color: "var(--rtd-orange)" },
  recovery: { label: "Recovery", color: "var(--rtd-red)" },
  business: { label: "Business", color: "var(--rtd-green)" },
  school: { label: "School", color: "var(--rtd-purple)" },
};

/** Pure sort: urgent first, then insertion order (callers push in a sensible domain order). */
export function sortAttentionItems(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

type TodaySessionLike = { title: string } | null;
type WeekDayLike = { swim: string | null };
type BusinessTaskLike = { id: number; title: string; dueDate: string | null; businessId: number; businessName: string };
type SchoolAssignmentLike = { id: number; name: string; courseName: string };

/**
 * Pure decision logic shared by the Home dashboard and the get_pending_items
 * MCP tool -- callers fetch their own data (different execution contexts
 * fetch differently) but share this so "what counts as needing attention"
 * can't drift between the UI and what external Claude sees.
 */
export function buildAttentionItems(input: {
  today: string;
  todayKey: string;
  hour: number;
  currentPhaseId: string;
  todaySession: TodaySessionLike;
  weekDay: WeekDayLike;
  loggedWorkoutToday: boolean;
  loggedSwimSessionToday: boolean;
  foodLoggedTodayCount: number;
  sleepLoggedToday: boolean;
  undoneBusinessTasks: BusinessTaskLike[];
  urgentSchoolAssignments: SchoolAssignmentLike[];
}): AttentionItem[] {
  const items: AttentionItem[] = [];

  if (input.todaySession && !input.loggedWorkoutToday) {
    items.push({
      id: "train-today",
      domain: "train",
      label: `Log today's gym session — ${input.todaySession.title}`,
      href: `/train/${input.currentPhaseId}?day=${input.todayKey}`,
      urgent: input.hour >= 20,
    });
  }

  if (input.weekDay.swim && !input.loggedSwimSessionToday) {
    items.push({
      id: "swim-today",
      domain: "swim",
      label: "Log today's swim session",
      detail: input.weekDay.swim,
      href: "/analytics",
      urgent: false,
    });
  }

  if (input.hour >= 10 && input.foodLoggedTodayCount === 0) {
    items.push({
      id: "fuel-today",
      domain: "fuel",
      label: "No meals logged yet today",
      href: "/fuel",
      urgent: input.hour >= 16,
    });
  }

  if (input.hour >= 9 && !input.sleepLoggedToday) {
    items.push({
      id: "recovery-sleep",
      domain: "recovery",
      label: "No sleep logged this morning",
      href: "/more/recovery",
      urgent: false,
    });
  }

  for (const t of input.undoneBusinessTasks) {
    items.push({
      id: `business-task-${t.id}`,
      domain: "business",
      label: t.title,
      detail: t.dueDate ? `${t.businessName} · due ${t.dueDate}` : t.businessName,
      href: `/business/${t.businessId}`,
      urgent: t.dueDate !== null && t.dueDate <= input.today,
    });
  }

  for (const a of input.urgentSchoolAssignments) {
    items.push({
      id: `school-${a.id}`,
      domain: "school",
      label: a.name,
      detail: a.courseName,
      href: "/school",
      urgent: false,
    });
  }

  return items;
}
