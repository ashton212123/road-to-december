/**
 * Derives buildDayFuelPlan's schedule inputs from the static weekly program
 * (season-data.json's WEEK array) rather than hardcoding weekday logic --
 * a swim string with a ";" describes multiple time blocks that day (e.g.
 * Saturday's AM+PM double, or Wed/Fri's 5 AM race-pace block plus the
 * afternoon session), and "race pace" in the swim string is the actual
 * signal for the 5 AM race-pace day, not the weekday itself.
 */

import type { SeedWeekDay } from "@/lib/data/types";
import type { SessionType } from "@/lib/swim/sessionType";

export function deriveDaySchedule(weekDay: SeedWeekDay): { scheduledSwims: number; scheduledGym: boolean; plannedSessionType: SessionType | null } {
  const scheduledSwims = weekDay.swim ? weekDay.swim.split(";").length : 0;
  const scheduledGym = weekDay.gym !== null;
  const plannedSessionType: SessionType | null = weekDay.swim && /race pace/i.test(weekDay.swim) ? "race_pace" : null;
  return { scheduledSwims, scheduledGym, plannedSessionType };
}
