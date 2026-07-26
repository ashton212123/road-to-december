/** Which week of which phase the athlete is in -- a question the app
 * couldn't answer before (G11). Pure date math against the phase's own
 * start/end dates, no DB reads. */

export type PhaseWeek = { weekInPhase: number; totalWeeksInPhase: number; label: string; daysRemaining: number };

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

export function computePhaseWeek(
  phase: { startDate: string; endDate: string; tag: string; name: string },
  todayISO: string
): PhaseWeek {
  const totalDays = Math.max(1, daysBetweenISO(phase.startDate, phase.endDate) + 1);
  const totalWeeksInPhase = Math.max(1, Math.ceil(totalDays / 7));
  const daysSinceStart = daysBetweenISO(phase.startDate, todayISO);
  const weekInPhase = Math.min(totalWeeksInPhase, Math.max(1, Math.floor(daysSinceStart / 7) + 1));
  const daysRemaining = Math.max(0, daysBetweenISO(todayISO, phase.endDate));

  return {
    weekInPhase,
    totalWeeksInPhase,
    label: `Week ${weekInPhase} of ${totalWeeksInPhase} · ${phase.tag} ${phase.name}`,
    daysRemaining,
  };
}
