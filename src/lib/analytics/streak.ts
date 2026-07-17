import { addDaysISO, dayKeyForDate } from "@/lib/time";

type PhaseWithSessions = { startDate: string; endDate: string; sessions: { dayKey: string }[] };

/**
 * Consecutive scheduled gym training days (per the periodized program) with
 * at least one logged set. Rest days don't break it. Today doesn't break it
 * either if not yet logged — you just haven't trained yet today.
 */
export function computeTrainingStreak(params: {
  today: string;
  phases: PhaseWithSessions[];
  loggedDates: Set<string>;
}): number {
  const { today, phases, loggedDates } = params;
  let streak = 0;
  let cursor = today;

  for (let i = 0; i < 400; i++) {
    const phase = phases.find((p) => cursor >= p.startDate && cursor <= p.endDate);
    if (!phase) break;

    const isScheduledGymDay = phase.sessions.some((s) => s.dayKey === dayKeyForDate(cursor));
    if (isScheduledGymDay) {
      if (loggedDates.has(cursor)) {
        streak++;
      } else if (cursor === today) {
        // Grace period: today isn't over yet.
      } else {
        break;
      }
    }
    cursor = addDaysISO(cursor, -1);
  }

  return streak;
}
