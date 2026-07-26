/** Protein target = 1.8–2.0 g/kg × 7-day-average bodyweight. Recomputed, never hardcoded. */
export function computeProteinTargetG(sevenDayAvgKg: number): { min: number; max: number; mid: number } {
  const min = Math.round(sevenDayAvgKg * 1.8);
  const max = Math.round(sevenDayAvgKg * 2.0);
  return { min, max, mid: Math.round((min + max) / 2) };
}

export function sevenDayAverage(weighIns: { date: string; kg: string | number }[]): number | null {
  if (weighIns.length === 0) return null;
  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? 1 : -1)); // newest first
  const window = sorted.slice(0, 7);
  const sum = window.reduce((acc, w) => acc + Number(w.kg), 0);
  return sum / window.length;
}
