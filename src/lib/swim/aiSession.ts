/**
 * AI-first swim logging: the athlete describes a session in his own words,
 * one Groq call structures it into zoned intervals. Supersedes the swim half
 * of lib/train/importSession.ts -- no numeric grids, no regex distance
 * parsing (lib/swim/parseSets.ts is retired in this same loop).
 */

import { callGroqChat } from "@/lib/ai/groq";
import type { Zone } from "./zones";
import type { Course } from "./course";

export type AiSwimInterval = {
  reps: number;
  distanceM: number;
  stroke: string;
  zone: Zone;
  targetInterval?: string;
  avgTime?: string;
  isKick: boolean;
  isPull: boolean;
  isDrill: boolean;
  note?: string;
};

export type AiSwimSession = {
  intervals: AiSwimInterval[];
  statedTotalDistanceM: number | null; // ONLY when the athlete states a total explicitly
  computedTotalDistanceM: number; // sum(reps x distanceM) -- computed here, never trusted from the model
  durationMin: number | null;
  sessionRpe: number | null; // 1-10, only if he states an effort
  course: Course | null;
  summary: string;
  notable: { event: string; timeMs: number; isRace: boolean }[];
};

const ZONES_LIST: Zone[] = ["REC", "EN1", "EN2", "EN3", "SP1", "SP2", "SP3", "TECH"];

const SYSTEM_PROMPT = `You structure a competitive swimmer's description of a training session into JSON. The athlete is a breaststroke and 400 IM specialist who trains in a 25m (SCM) pool and races in 50m (LCM). He describes sessions the way he'd tell a teammate -- informally, sometimes out of order, sometimes stating only a total.

Return ONLY a JSON object. No markdown fences, no commentary.

{"intervals":[{"reps":8,"distanceM":50,"stroke":"breast","zone":"SP1","targetInterval":"1:10","avgTime":"38s","isKick":false,"isPull":false,"isDrill":false,"note":null}],
 "statedTotalDistanceM":4500,"durationMin":110,"sessionRpe":7,"course":"SCM",
 "summary":"Race-pace breaststroke session built around 8x50 at goal 100 pace.",
 "notable":[]}

RULES

1. EVERY segment he describes becomes its own interval object -- warm-up, drills, kick sets, pull sets, main set, warm-down. If he describes 6 things, return 6 intervals. Never merge, never summarise a segment away.

2. statedTotalDistanceM: set this ONLY when he explicitly states a session total ("4.5km", "did 4500 total", "about 5k"). Convert km to metres. If he never states a total, return null. NEVER compute it yourself -- the caller computes the sum separately and compares. This field means "the athlete said this number", nothing else.

3. zone -- classify every interval into exactly one of:
   REC  = active recovery, easy swimming, loosen down
   EN1  = aerobic base; long/steady, comfortable, short rest
   EN2  = threshold; sustained hard-but-controlled, "best average", descending sets
   EN3  = VO2/overload; short rest, close to maximal aerobic, gasping
   SP1  = race pace; rehearsing goal race velocity, generous rest
   SP2  = lactate power; maximal 25-75m efforts, long rest
   SP3  = alactic speed; <=15m bursts, starts, breakouts, turns, full recovery
   TECH = drill or technique work at low effort
   When genuinely ambiguous, choose the LOWER-intensity zone. Do not guess upward.

4. Stroke abbreviations: fr/free=freestyle, br/breast=breast, bk/back=backstroke, fl/fly=butterfly, im=IM. Set isKick/isPull/isDrill as booleans; keep the STROKE in the stroke field (a breaststroke kick set is stroke "breast" with isKick true, never stroke "kick").

5. durationMin: only if he states or clearly implies a duration. sessionRpe: 1-10, only if he describes overall effort ("brutal", "easy day", "8/10"). Otherwise null for both. Never invent either.

6. course: "SCM" or "LCM" only if he says which pool. Otherwise null.

7. summary: ONE factual sentence naming the session's main work. No praise, no motivation, no adjectives about how he did.

8. notable: only a real clocked time for a named event that he explicitly states ("time trialled 200 breast 2:25.40"). Set isRace true only if he says it was at a meet. Otherwise return an empty array. Never promote a regular interval into a notable time.`;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function normalizeZone(v: unknown): Zone {
  return typeof v === "string" && ZONES_LIST.includes(v as Zone) ? (v as Zone) : "EN1";
}

function normalizeCourse(v: unknown): Course | null {
  return v === "SCM" || v === "LCM" ? v : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function normalizeIntervals(raw: unknown): AiSwimInterval[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r): AiSwimInterval | null => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const reps = num(o.reps);
      const distanceM = num(o.distanceM);
      if (reps === null || distanceM === null || reps <= 0 || distanceM <= 0 || typeof o.stroke !== "string") return null;
      return {
        reps,
        distanceM,
        stroke: o.stroke,
        zone: normalizeZone(o.zone),
        targetInterval: typeof o.targetInterval === "string" ? o.targetInterval : undefined,
        avgTime: typeof o.avgTime === "string" ? o.avgTime : undefined,
        isKick: o.isKick === true,
        isPull: o.isPull === true,
        isDrill: o.isDrill === true,
        note: typeof o.note === "string" ? o.note : undefined,
      };
    })
    .filter((x): x is AiSwimInterval => x !== null);
}

function normalizeNotable(raw: unknown): AiSwimSession["notable"] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((n) => {
      if (!n || typeof n !== "object") return null;
      const o = n as Record<string, unknown>;
      const timeMs = num(o.timeMs);
      if (typeof o.event !== "string" || timeMs === null) return null;
      return { event: o.event, timeMs, isRace: o.isRace === true };
    })
    .filter((x): x is AiSwimSession["notable"][number] => x !== null);
}

/** Parses a described swim session. Returns null if Groq is unavailable, the
 * call fails, or the response has no usable intervals -- the caller falls
 * back to manual (distance + duration + RPE only) logging. */
export async function parseSwimSession(text: string): Promise<AiSwimSession | null> {
  const content = await callGroqChat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: text },
    ],
    { jsonMode: true, temperature: 0.15 }
  );
  if (!content) return null;

  try {
    const raw = JSON.parse(content) as Record<string, unknown>;
    const intervals = normalizeIntervals(raw.intervals);
    if (intervals.length === 0) return null;

    const computedTotalDistanceM = intervals.reduce((sum, iv) => sum + iv.reps * iv.distanceM, 0);
    const statedRaw = num(raw.statedTotalDistanceM);

    return {
      intervals,
      statedTotalDistanceM: statedRaw !== null && statedRaw > 0 ? Math.round(statedRaw) : null,
      computedTotalDistanceM,
      durationMin: (() => {
        const d = num(raw.durationMin);
        return d === null ? null : Math.round(clamp(d, 20, 240));
      })(),
      sessionRpe: (() => {
        const r = num(raw.sessionRpe);
        return r === null ? null : Math.round(clamp(r, 1, 10));
      })(),
      course: normalizeCourse(raw.course),
      summary: typeof raw.summary === "string" && raw.summary.trim() ? raw.summary.trim() : "Swim session.",
      notable: normalizeNotable(raw.notable),
    };
  } catch {
    return null;
  }
}

export type DistanceReconciliation = {
  finalM: number;
  source: "stated" | "computed";
  discrepancyPct: number | null;
  needsReview: boolean;
  message: string | null;
};

/** The athlete's own stated total always wins over the sum of parsed
 * intervals -- this is the fix for the "said 4.5km, app showed 3k" bug
 * (regex under-counting is retired entirely, but even a good structured
 * parse can miss a segment, and his own number is the more trustworthy
 * source when he gave one). */
export function reconcileDistance(statedM: number | null, computedM: number): DistanceReconciliation {
  if (statedM === null) {
    return { finalM: computedM, source: "computed", discrepancyPct: null, needsReview: false, message: null };
  }
  const discrepancyPct = statedM > 0 ? (Math.abs(statedM - computedM) / statedM) * 100 : 0;
  const needsReview = discrepancyPct > 10;
  return {
    finalM: statedM,
    source: "stated",
    discrepancyPct,
    needsReview,
    message: needsReview
      ? `You said ${statedM.toLocaleString()}m; the sets I parsed add up to ${computedM.toLocaleString()}m (${discrepancyPct.toFixed(0)}% off). Using your stated total — tap a set to fix what I missed.`
      : null,
  };
}
