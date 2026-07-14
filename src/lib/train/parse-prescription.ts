export type ParsedPrescription = {
  targetSets: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  pct1rmMin: number | null;
  pct1rmMax: number | null;
  rpeMin: number | null;
  rpeMax: number | null;
};

const EMPTY: ParsedPrescription = {
  targetSets: null,
  targetRepsMin: null,
  targetRepsMax: null,
  pct1rmMin: null,
  pct1rmMax: null,
  rpeMin: null,
  rpeMax: null,
};

/**
 * Best-effort extraction of numeric targets from a free-text prescription
 * string like "4×6 @ 70–75%" or "3×5/leg @ RPE 8". Prescriptions that are
 * pure prose ("Wave · 3min rest") intentionally parse to nulls — the raw
 * string is always kept alongside for display.
 */
export function parsePrescription(raw: string): ParsedPrescription {
  if (!raw) return { ...EMPTY };

  const normalized = raw.replace(/[–—]/g, "-").replace(/×/g, "x");

  const result: ParsedPrescription = { ...EMPTY };

  const setsReps = normalized.match(/(\d+)\s*x\s*(\d+)(?:-(\d+))?/i);
  if (setsReps) {
    result.targetSets = Number(setsReps[1]);
    result.targetRepsMin = Number(setsReps[2]);
    result.targetRepsMax = setsReps[3] ? Number(setsReps[3]) : Number(setsReps[2]);
  }

  const pct = normalized.match(/(\d+)\s*-\s*(\d+)\s*%/);
  if (pct) {
    result.pct1rmMin = Number(pct[1]);
    result.pct1rmMax = Number(pct[2]);
  } else {
    const pctSingle = normalized.match(/@\s*(\d+)\s*%/);
    if (pctSingle) {
      result.pct1rmMin = Number(pctSingle[1]);
      result.pct1rmMax = Number(pctSingle[1]);
    }
  }

  const rpe = normalized.match(/RPE\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/i);
  if (rpe) {
    result.rpeMin = Number(rpe[1]);
    result.rpeMax = Number(rpe[2]);
  } else {
    const rpeSingle = normalized.match(/RPE\s*(\d+(?:\.\d+)?)/i);
    if (rpeSingle) {
      result.rpeMin = Number(rpeSingle[1]);
      result.rpeMax = Number(rpeSingle[1]);
    }
  }

  return result;
}
