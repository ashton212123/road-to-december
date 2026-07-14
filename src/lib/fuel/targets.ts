import { seasonData } from "../data/season-data";

export type KcalTarget = {
  min: number;
  max: number;
  mid: number;
  isBulkWindow: boolean;
  needsConfirmation: boolean;
  label: string;
};

/**
 * Kcal target is computed from the bulk window, never hardcoded past it.
 * Jul–Aug 30: 3,300–3,500 kcal/day (the program's gain window). After
 * Aug 30 the program calls for a maintenance recalculation the athlete
 * must confirm — until they do, we surface the bulk-window numbers with a
 * "needs confirmation" flag rather than inventing a maintenance figure.
 */
export function computeKcalTarget(todayISO: string): KcalTarget {
  const isBulkWindow = todayISO <= seasonData.meta.bulkWindowEnd;
  if (isBulkWindow) {
    return {
      min: 3300,
      max: 3500,
      mid: 3400,
      isBulkWindow: true,
      needsConfirmation: false,
      label: "3,300–3,500 kcal/day (bulk window)",
    };
  }
  // Maintenance figure is intentionally not hardcoded — flagged for the
  // athlete/coach to confirm once the bulk window has ended.
  return {
    min: 3300,
    max: 3500,
    mid: 3400,
    isBulkWindow: false,
    needsConfirmation: true,
    label: "Maintenance target not yet confirmed — using bulk-window numbers until set in Settings",
  };
}

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
