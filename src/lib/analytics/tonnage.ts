import { mondayOf } from "@/lib/time";

const HARD_SET_RPE_THRESHOLD = 8;

export type TonnageRow = {
  weekStart: string;
  squat: number;
  hinge: number;
  press: number;
  pull: number;
};

export type HardSetRow = TonnageRow;

type LogWithPattern = {
  date: string;
  weightKg: string | null;
  reps: number | null;
  rpe: string | null;
  movementPattern: string | null;
};

const PATTERNS = ["squat", "hinge", "press", "pull"] as const;

function emptyRow(weekStart: string): TonnageRow {
  return { weekStart, squat: 0, hinge: 0, press: 0, pull: 0 };
}

export function computeWeeklyTonnage(logs: LogWithPattern[]): TonnageRow[] {
  const byWeek = new Map<string, TonnageRow>();
  for (const log of logs) {
    const pattern = log.movementPattern;
    if (!pattern || !(PATTERNS as readonly string[]).includes(pattern)) continue;
    if (!log.weightKg || !log.reps) continue;
    const weekStart = mondayOf(log.date);
    if (!byWeek.has(weekStart)) byWeek.set(weekStart, emptyRow(weekStart));
    const row = byWeek.get(weekStart)!;
    row[pattern as (typeof PATTERNS)[number]] += Number(log.weightKg) * log.reps;
  }
  return [...byWeek.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}

export function computeWeeklyHardSets(logs: LogWithPattern[]): HardSetRow[] {
  const byWeek = new Map<string, HardSetRow>();
  for (const log of logs) {
    const pattern = log.movementPattern;
    if (!pattern || !(PATTERNS as readonly string[]).includes(pattern)) continue;
    if (!log.rpe || Number(log.rpe) < HARD_SET_RPE_THRESHOLD) continue;
    const weekStart = mondayOf(log.date);
    if (!byWeek.has(weekStart)) byWeek.set(weekStart, emptyRow(weekStart));
    byWeek.get(weekStart)![pattern as (typeof PATTERNS)[number]] += 1;
  }
  return [...byWeek.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
}
