/**
 * V4 P4: paste a session, one Groq call classifies swim vs gym and returns
 * structured data. Same trust pattern as meal quick log -- nothing here
 * ever writes to the DB; the caller always reviews before saving. Every
 * export resolves to null on a missing key, network error, or malformed
 * response rather than throwing, so the review card can fall back to "keep
 * the pasted text, offer manual logging" without an error boundary.
 */

import { callGroqChat } from "@/lib/ai/groq";

export type ParsedSwimInterval = {
  reps: number;
  distanceM: number;
  stroke: string;
  targetInterval?: string;
  avgTime?: string;
  note?: string;
};

export type ParsedSwimSession = {
  intervals: ParsedSwimInterval[];
  totalDistanceM: number;
  setsText: string;
  loadRatingSuggestion: number;
  notable: { event: string; timeMs: number }[];
};

export type ParsedGymSet = {
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
};

export type ParsedGymExercise = {
  exerciseName: string;
  sets: ParsedGymSet[];
};

export type ParseSessionResult =
  | { kind: "swim"; session: ParsedSwimSession }
  | { kind: "gym"; exercises: ParsedGymExercise[] };

const SYSTEM_PROMPT = `You structure a competitive swimmer's pasted training-session notes into JSON. First decide if the session is a SWIM practice or a GYM/weights session, then return ONLY a JSON object of the matching shape below -- no other text.

SWIM shape:
{"kind":"swim","intervals":[{"reps":8,"distanceM":50,"stroke":"breast","targetInterval":"1:10","avgTime":"38s","note":null}],"loadRatingSuggestion":6,"notable":[]}
- Parse real interval notation: "8x50 br @1:10 hold 38s" -> reps 8, distanceM 50, stroke "breast", targetInterval "1:10", avgTime "38s". Stroke abbreviations: fr/free=freestyle, br=breast, bk/back=backstroke, fl/fly=butterfly, im=IM, pull/kick/drill stay as written.
- Warm-up and warm-down/cool-down lines get an interval with note "W/U" or "W/D" (or "drill" for drill sets) -- these must still appear as intervals (reps 1 if not repeated), just flagged so pace analysis can exclude them.
- loadRatingSuggestion is your 1-10 subjective estimate of session difficulty from total volume + intensity (long aerobic volume ~3-5, mixed main set ~5-7, heavy race-pace/sprint work ~7-9).
- notable: only include a race-pace or time-trial effort explicitly stated as a real clocked time for a named event (e.g. "time trial 200 breast 2:25.40" -> {"event":"200 Breast","timeMs":145400}). Leave empty if nothing like that is mentioned -- do not invent one from a regular interval.

GYM shape:
{"kind":"gym","exercises":[{"exerciseName":"Back squat","sets":[{"weightKg":80,"reps":5,"rpe":8}]}]}
- One entry per exercise named, sets in the order described. Omit weightKg/reps/rpe (use null) for anything not stated.

Respond with ONLY the JSON object, no markdown fences, no commentary.`;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalizeSwim(raw: Record<string, unknown>): ParsedSwimSession | null {
  const rawIntervals = raw.intervals;
  if (!Array.isArray(rawIntervals)) return null;

  const intervals: ParsedSwimInterval[] = rawIntervals
    .map((r): ParsedSwimInterval | null => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const reps = num(o.reps);
      const distanceM = num(o.distanceM);
      if (reps === null || distanceM === null || typeof o.stroke !== "string") return null;
      return {
        reps,
        distanceM,
        stroke: o.stroke,
        targetInterval: typeof o.targetInterval === "string" ? o.targetInterval : undefined,
        avgTime: typeof o.avgTime === "string" ? o.avgTime : undefined,
        note: typeof o.note === "string" ? o.note : undefined,
      };
    })
    .filter((x): x is ParsedSwimInterval => x !== null);
  if (intervals.length === 0) return null;

  const totalDistanceM = intervals.reduce((sum, iv) => sum + iv.reps * iv.distanceM, 0);
  const setsText = intervals
    .map((iv) => `${iv.note ? `${iv.note} ` : ""}${iv.reps}x${iv.distanceM} ${iv.stroke}${iv.targetInterval ? ` @${iv.targetInterval}` : ""}`)
    .join(", ");

  const loadRatingSuggestion = Math.max(1, Math.min(10, Math.round(num(raw.loadRatingSuggestion) ?? 5)));

  const notable = Array.isArray(raw.notable)
    ? raw.notable
        .map((n) => {
          if (!n || typeof n !== "object") return null;
          const o = n as Record<string, unknown>;
          const timeMs = num(o.timeMs);
          if (typeof o.event !== "string" || timeMs === null) return null;
          return { event: o.event, timeMs };
        })
        .filter((x): x is { event: string; timeMs: number } => x !== null)
    : [];

  return { intervals, totalDistanceM, setsText, loadRatingSuggestion, notable };
}

function normalizeGym(raw: Record<string, unknown>): ParsedGymExercise[] | null {
  const rawExercises = raw.exercises;
  if (!Array.isArray(rawExercises)) return null;

  const exercises = rawExercises
    .map((r): ParsedGymExercise | null => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      if (typeof o.exerciseName !== "string" || !o.exerciseName.trim()) return null;
      const rawSets = Array.isArray(o.sets) ? o.sets : [];
      const sets: ParsedGymSet[] = rawSets.map((s, i) => {
        const so = (s && typeof s === "object" ? (s as Record<string, unknown>) : {}) as Record<string, unknown>;
        return { setNumber: i + 1, weightKg: num(so.weightKg), reps: num(so.reps), rpe: num(so.rpe) };
      });
      return { exerciseName: o.exerciseName.trim(), sets };
    })
    .filter((x): x is ParsedGymExercise => x !== null);

  return exercises.length > 0 ? exercises : null;
}

/** Parses a pasted training session. Returns null if Groq is unavailable, the
 * call fails, or the response doesn't resolve to a usable swim/gym shape --
 * the caller must keep the original pasted text and offer manual logging. */
export async function parseTrainingSession(text: string): Promise<ParseSessionResult | null> {
  const content = await callGroqChat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    { jsonMode: true, temperature: 0.2 }
  );
  if (!content) return null;

  try {
    const raw = JSON.parse(content) as Record<string, unknown>;
    if (raw.kind === "swim") {
      const session = normalizeSwim(raw);
      return session ? { kind: "swim", session } : null;
    }
    if (raw.kind === "gym") {
      const exercises = normalizeGym(raw);
      return exercises ? { kind: "gym", exercises } : null;
    }
    return null;
  } catch {
    return null;
  }
}
