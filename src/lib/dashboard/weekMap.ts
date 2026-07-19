import { addDaysISO } from "@/lib/time";

export type WeekMapRow = {
  label: string;
  cells: ("logged" | "missed" | "future" | "rest")[];
  adherencePct: number | null;
};

/** Builds the 7-day x N-category dot grid for Home's Week Map -- Mon..Sun of
 * the current week, each cell green/red/gray from whether that category was
 * logged that day. Adherence % only counts days that have already happened
 * and weren't rest days. */
export function buildWeekMap(params: {
  today: string;
  weekStartISO: string; // Monday of the current week
  scheduledSwimDays: Set<string>; // ISO dates with a swim scheduled
  scheduledGymDays: Set<string>; // ISO dates with a gym session scheduled
  loggedSwimDates: Set<string>;
  loggedGymDates: Set<string>;
  loggedFoodDates: Set<string>;
  loggedSleepDates: Set<string>;
}): { days: { iso: string; short: string }[]; rows: WeekMapRow[] } {
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const days = dayLabels.map((short, i) => ({ iso: addDaysISO(params.weekStartISO, i), short }));

  function buildRow(label: string, scheduled: Set<string> | null, logged: Set<string>): WeekMapRow {
    let countable = 0;
    let hit = 0;
    const cells = days.map(({ iso }) => {
      const isFuture = iso > params.today;
      const isScheduled = scheduled === null || scheduled.has(iso);
      if (!isScheduled) return "rest" as const;
      if (isFuture) return "future" as const;
      countable++;
      if (logged.has(iso)) {
        hit++;
        return "logged" as const;
      }
      return "missed" as const;
    });
    return { label, cells, adherencePct: countable > 0 ? Math.round((hit / countable) * 100) : null };
  }

  return {
    days,
    rows: [
      buildRow("Swim", params.scheduledSwimDays, params.loggedSwimDates),
      buildRow("Gym", params.scheduledGymDays, params.loggedGymDates),
      buildRow("Fuel", null, params.loggedFoodDates),
      buildRow("Sleep", null, params.loggedSleepDates),
    ],
  };
}
