/** Epley formula, per spec: weight × (1 + reps/30). */
export function epley1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export function bestSetE1RM(sets: { weightKg: number | null; reps: number | null }[]): number | null {
  const values = sets
    .filter((s) => s.weightKg && s.reps)
    .map((s) => epley1RM(Number(s.weightKg), Number(s.reps)));
  if (values.length === 0) return null;
  return Math.max(...values);
}
