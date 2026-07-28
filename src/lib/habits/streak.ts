import type { DotStatus } from "@/components/ui/DotStrip";
import type { HabitDailyCompletion } from "./queries";
import { addDaysISO } from "@/lib/time";

/** Maps the 30-day completion window onto DotStrip's 3-color vocabulary:
 * every active habit done that day = improved (green), nothing logged =
 * flat (gray/neutral, not "bad"), anything partial = declined (red) so an
 * incomplete day is visually distinct from a rest day with no log at all. */
export function buildHabitStreakDots(
  dailyCompletion: HabitDailyCompletion[],
  activeHabitCount: number,
  todayISO: string,
  days = 30
): { status: DotStatus; label: string }[] {
  const byDate = new Map(dailyCompletion.map((d) => [d.date, d]));
  const dots: { status: DotStatus; label: string }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = addDaysISO(todayISO, -i);
    const day = byDate.get(date);
    const completedCount = day ? Number(day.completedCount) : 0;
    const status: DotStatus =
      completedCount === 0 ? "flat" : activeHabitCount > 0 && completedCount >= activeHabitCount ? "improved" : "declined";
    dots.push({ status, label: `${date}: ${completedCount}/${activeHabitCount}` });
  }

  return dots;
}
