import { bestSetE1RM } from "./e1rm";

export type LoggedSet = { weightKg: number | null; reps: number | null; rpe: number | null };

export type ProgressionSuggestion = {
  headline: string;
  rationale: string;
};

/**
 * Progression assistant per program.md's rules:
 *  - P2 (Muscle + Base): +2.5–5kg or +1 rep/week if last RPE was at/under
 *    target; hold or reduce if RPE exceeded target.
 *  - P3/P4 (wave phases): wave-loading % targets computed from the lift's
 *    current e1RM (Epley, best set of the last logged session).
 *  - Everything else: just surface last session's numbers, no suggestion.
 */
export function suggestNextLoad(params: {
  phaseId: string;
  lastSessionSets: LoggedSet[];
  rpeTargetMax: number | null;
  waveScheme?: { sets: number; reps: number; pctMin: number; pctMax: number }[] | null;
}): ProgressionSuggestion | null {
  const { phaseId, lastSessionSets, rpeTargetMax, waveScheme } = params;
  if (lastSessionSets.length === 0) return null;

  const lastRpes = lastSessionSets.map((s) => s.rpe).filter((r): r is number => r !== null);
  const maxRpeLogged = lastRpes.length > 0 ? Math.max(...lastRpes) : null;
  const exceededTarget = rpeTargetMax !== null && maxRpeLogged !== null && maxRpeLogged > rpeTargetMax;

  if (phaseId === "p2") {
    if (exceededTarget) {
      return {
        headline: "Hold or reduce load",
        rationale: `Last session's RPE (${maxRpeLogged}) exceeded the target (${rpeTargetMax}) — repeat the same weight or drop slightly this week.`,
      };
    }
    const lastTopSet = lastSessionSets.reduce<LoggedSet | null>((best, s) => {
      if (!s.weightKg) return best;
      if (!best || (best.weightKg ?? 0) < s.weightKg) return s;
      return best;
    }, null);
    const nextWeight = lastTopSet?.weightKg ? lastTopSet.weightKg + 2.5 : null;
    return {
      headline: nextWeight
        ? `Try ${nextWeight}–${(lastTopSet!.weightKg! + 5).toFixed(1)} kg, or +1 rep/set`
        : "Add 2.5–5 kg or +1 rep/set vs last week",
      rationale: "RPE was on target last session — the gain window calls for a small weekly bump.",
    };
  }

  if ((phaseId === "p3" || phaseId === "p4") && waveScheme && waveScheme.length > 0) {
    const e1rm = bestSetE1RM(lastSessionSets);
    if (!e1rm) return null;
    const lines = waveScheme.map((w) => {
      const min = Math.round((e1rm * w.pctMin) / 100 / 2.5) * 2.5;
      const max = Math.round((e1rm * w.pctMax) / 100 / 2.5) * 2.5;
      return `${w.sets}×${w.reps} @ ${min === max ? `${min}kg` : `${min}–${max}kg`}`;
    });
    return {
      headline: lines.join(" → "),
      rationale: `Wave % computed from your current e1RM (${e1rm.toFixed(1)} kg, Epley from last logged top set).`,
    };
  }

  return null;
}
