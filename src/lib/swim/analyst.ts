/**
 * "The Analyst" -- Ashton's own swim-coach system prompt (verbatim, see
 * ANALYST_SYSTEM_PROMPT below), turned into a server module. Distinct from
 * aiSession.ts (structures a described session into intervals for manual
 * logging) and sessionAnalysis.ts (writes a 3-paragraph physiological read
 * from already-computed numbers) -- this module owns its own parse +
 * calculate + narrate pipeline end to end, on its own 7-zone taxonomy
 * (REC/TECH/EN1/EN2/EN3/SP1/SP2, no SP3), and is the one whose output feeds
 * swim_sessions.equipmentDistanceM / qualityDistanceM (added in WS4 §1).
 *
 * Code-level enforcement (per WS4 §2 -- these are guarantees the prompt
 * alone can't make):
 *  - This module never reads or writes setsText. Callers persist the
 *    athlete's raw text verbatim; nothing here returns a "cleaned" or
 *    "normalised" copy of it that could be mistaken for storage.
 *  - parsedDistanceM is never asked of the model directly -- it is always
 *    the code-computed sum of (distanceM x sets) across the model's own
 *    itemised setByStepLog entries, so the reported total can never drift
 *    from (or invent beyond) what the model itemised set by set, and an
 *    outer repeat count (WS4 §4b) is always applied by code, never left to
 *    the model's own mental arithmetic.
 *  - The model is never shown statedTotalDistanceM. It parses from the raw
 *    text alone, so it structurally cannot adjust its reading to match a
 *    stated figure (WS4 §3) -- that comparison happens in the caller.
 *  - Genuinely ambiguous sets still get a single best-effort reading (so
 *    totals stay computable) but must also produce an `ambiguities` entry
 *    naming what was uncertain -- the pick is disclosed, never silent.
 *  - Zone/intensity classification lives only in setByStepLog[].zone and
 *    intensityDistributionM -- both clearly-labelled derived fields,
 *    structurally separate from the athlete's own words.
 */

import { callGroqChat } from "@/lib/ai/groq";

// ---------------------------------------------------------------------
// Ashton's system prompt, verbatim. Do not paraphrase, condense, reorder,
// or "improve" this text -- see WS4 §2. If it needs to change, the change
// comes from Ashton, not from refactoring here.
// ---------------------------------------------------------------------
export const ANALYST_SYSTEM_PROMPT = `You are my elite swimming training logger and analyst.

I will write workouts exactly how swimmers write them. They may be incomplete, messy, abbreviated, or missing punctuation.

Your job is to understand them exactly as an experienced national-level swim coach would.

## Parsing Rules

Assume all distances are in meters.

Understand common swim shorthand automatically.

Examples:
- free = freestyle
- fr = freestyle
- bk = backstroke
- br = breaststroke
- fly = butterfly
- im = individual medley
- s1 = stroke 1 (the stroke written after it)
- fins = fins
- pb = pull buoy
- paddles = paddles
- snorkel = snorkel

Interpret workouts naturally.

Example:

3x16x50
1st fly
2nd back
3rd breast

means

Set 1:
16×50
25 fly 25 free

Set 2:
16×50
25 back 25 free

Set 3:
16×50
25 breast 25 free

unless I explicitly write something different.

If I write

4x8x50
1st on 1:00
2nd 55
3rd 50
4th 45

under breaststroke,

understand that there are FOUR rounds of 8×50 breaststroke with descending send-offs.

Never ask for clarification unless multiple interpretations are genuinely possible.

Use swimming common sense.

## Calculate

Always calculate:

• Total distance
• Stroke volume
• Kick volume
• Pull volume
• Drill volume
• Fins volume
• Paddle volume
• Snorkel volume
• Race-pace volume
• Aerobic volume
• Recovery volume
• Technique volume

Estimate intensity distribution using:

REC
TECH
EN1
EN2
EN3
SP1
SP2

If I don't specify an intensity, infer it from the set.

Examples:

drills → TECH

easy warmup → EN1

long aerobic repeats → EN2

threshold → EN3

race pace → SP1

all-out sprint → SP2

## Output

Always produce:

# Session Title

Example:
Race-Pace Breaststroke Session

# Overview

Total Distance

Quality Distance

Quality %

Stroke Breakdown

Equipment Breakdown

Kick Volume

Estimated Duration

Training Load (1–10)

Primary Energy System

Primary Focus

# Set-by-set Log

Every set should contain

distance

stroke

equipment

interval

zone

notes

# Session Analysis

Explain what this session is trying to improve.

Mention strengths and weaknesses.

Compare it with previous sessions if available.

Never rewrite my workout.

Never invent reps.

Never change intervals.

Only interpret swimming shorthand exactly as an experienced coach would.`;

// The verbatim prompt above describes a narrative (markdown-headers) output
// shape. This block is appended separately at call time -- never merged
// into the constant above -- so ANALYST_SYSTEM_PROMPT stays independently
// diffable against the original text with zero contamination.
const JSON_SCHEMA_INSTRUCTIONS = `---

For this integration, respond with ONLY a single JSON object (no markdown fences, no commentary, no "# Session Title" headers) matching this exact shape:

{
  "sessionTitle": string,
  "setByStepLog": [
    { "distanceM": number, "sets": number, "stroke": string, "equipment": string[], "interval": string | null, "zone": "REC" | "TECH" | "EN1" | "EN2" | "EN3" | "SP1" | "SP2", "notes": string | null }
  ],
  "overview": {
    "qualityDistanceM": number,
    "qualityPct": number,
    "strokeBreakdownM": { "<stroke>": number },
    "equipmentBreakdownM": { "<equipment>": number },
    "kickVolumeM": number,
    "pullVolumeM": number,
    "drillVolumeM": number,
    "finsVolumeM": number,
    "paddleVolumeM": number,
    "snorkelVolumeM": number,
    "racePaceVolumeM": number,
    "aerobicVolumeM": number,
    "recoveryVolumeM": number,
    "techniqueVolumeM": number,
    "estimatedDurationMin": number | null,
    "trainingLoad": number,
    "primaryEnergySystem": string,
    "primaryFocus": string
  },
  "intensityDistributionM": { "REC": number, "TECH": number, "EN1": number, "EN2": number, "EN3": number, "SP1": number, "SP2": number },
  "sessionAnalysis": string,
  "ambiguities": [ { "location": string, "issue": string, "readings": string[] } ]
}

Do NOT include a top-level total-distance field -- the caller computes it itself as the sum of (distanceM x sets) across setByStepLog.

"distanceM" is the distance covered by ONE occurrence of that block. "sets" is how many times the whole block repeats as a unit (1 when there is no separate outer repeat). Do the reps-within-a-block arithmetic yourself and put the result in "distanceM" (e.g. "8x100" under one send-off is distanceM=800, sets=1) -- but if the athlete's shorthand then wraps that whole block in a further outer repeat (e.g. "...3 sets", "3 rounds of ...", a leading "3x" in front of an already-multiplied block), put the block's own distance in "distanceM" and the outer repeat count in "sets" instead of multiplying them together yourself. "sets" is required on every entry -- never omit it even when it's 1.

Every setByStepLog entry must correspond to something explicitly stated or unambiguously implied by the athlete's own shorthand -- never invent a rep count, distance, sets count, or interval. When a set is genuinely ambiguous, still give your single best reading (so totals stay computable) but add a matching entry to "ambiguities" naming what was uncertain and what the other genuine reading(s) would have been. An empty "ambiguities" array means nothing was ambiguous, not that you skipped checking.`;

// ---------------------------------------------------------------------
// WS4 §4b Task 2 -- notation-parsing mechanics only (no coaching judgment,
// which stays in ANALYST_SYSTEM_PROMPT above). Appended to the USER message
// carrying the athlete's raw text, never merged into the system prompt.
// ---------------------------------------------------------------------
export const SWIM_SHORTHAND_RULES = `---

Notation rules for this session's shorthand (parsing mechanics only):

- TRAILING multiplier: when a repeat count trails a reps x distance block ("4x100 frim 3 sets", "4x100 x 3 sets", "..., 3 sets"), the trailing count multiplies the ENTIRE preceding block. "4x100 frim 3 sets" = 3 x (4 x 100) = 1200m. ("frim" is a typo for "from".)
- LEADING multiplier: when the repeat count leads ("3x16x50"), it multiplies the same way: 3 x 16 x 50 = 2400m.
- PAIRED distances under a rep count: "25 scull + 25 IM" (or any "+"-joined list of distances) listed under a rep count means each listed distance counts once PER REP, not once total.
- For every setByStepLog entry, put the distance of ONE occurrence of the block in "distanceM" and the number of times that whole block repeats in "sets" (default 1 when there is no outer repeat). Never fold an outer repeat count into "distanceM" yourself -- state it separately in "sets" so it can never be silently dropped.`;

export type AnalystZone = "REC" | "TECH" | "EN1" | "EN2" | "EN3" | "SP1" | "SP2";
const ANALYST_ZONES: AnalystZone[] = ["REC", "TECH", "EN1", "EN2", "EN3", "SP1", "SP2"];

export type AnalystSetEntry = {
  /** Distance of ONE occurrence of this block -- see `sets`. */
  distanceM: number;
  /** How many times this block repeats as a unit; 1 when there is no
   * separate outer repeat (WS4 §4b). Code -- never the model's own mental
   * math -- multiplies this against distanceM. */
  sets: number;
  stroke: string;
  equipment: string[];
  interval: string | null;
  zone: AnalystZone;
  notes: string | null;
};

export type AnalystAmbiguity = {
  location: string;
  issue: string;
  readings: string[];
};

export type AnalystOverview = {
  qualityDistanceM: number;
  qualityPct: number;
  strokeBreakdownM: Record<string, number>;
  equipmentBreakdownM: Record<string, number>;
  kickVolumeM: number;
  pullVolumeM: number;
  drillVolumeM: number;
  finsVolumeM: number;
  paddleVolumeM: number;
  snorkelVolumeM: number;
  racePaceVolumeM: number;
  aerobicVolumeM: number;
  recoveryVolumeM: number;
  techniqueVolumeM: number;
  estimatedDurationMin: number | null;
  trainingLoad: number;
  primaryEnergySystem: string;
  primaryFocus: string;
};

export type AnalystResult = {
  sessionTitle: string;
  setByStepLog: AnalystSetEntry[];
  /** Sum of setByStepLog[].distanceM, computed here -- never asked of or
   * trusted from the model directly. This is what callers store as
   * swim_sessions.parsedDistanceM. */
  parsedDistanceM: number;
  overview: AnalystOverview;
  /** Derived, separate from the athlete's own words -- never merge into
   * setsText or any per-set "notes" field. */
  intensityDistributionM: Record<AnalystZone, number>;
  sessionAnalysis: string;
  ambiguities: AnalystAmbiguity[];
};

export type AnalystPreviousSession = {
  date: string;
  sessionTitle: string;
  totalDistanceM: number;
  primaryFocus: string;
};

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function numOr0(v: unknown): number {
  const n = num(v);
  return n === null ? 0 : n;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function strOr(v: unknown, fallback: string): string {
  return str(v) ?? fallback;
}

function normalizeZone(v: unknown): AnalystZone {
  return typeof v === "string" && ANALYST_ZONES.includes(v as AnalystZone) ? (v as AnalystZone) : "EN1";
}

function normalizeEquipment(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((x) => x.trim());
}

function normalizeStringRecord(v: unknown): Record<string, number> {
  if (!v || typeof v !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = num(val);
    if (n !== null) out[k] = n;
  }
  return out;
}

function normalizeSets(v: unknown): number {
  const n = num(v);
  return n !== null && n >= 1 ? n : 1;
}

function normalizeSetByStepLog(raw: unknown): AnalystSetEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r): AnalystSetEntry | null => {
      if (!r || typeof r !== "object") return null;
      const o = r as Record<string, unknown>;
      const distanceM = num(o.distanceM);
      const stroke = str(o.stroke);
      if (distanceM === null || distanceM <= 0 || !stroke) return null;
      return {
        distanceM,
        sets: normalizeSets(o.sets),
        stroke,
        equipment: normalizeEquipment(o.equipment),
        interval: str(o.interval),
        zone: normalizeZone(o.zone),
        notes: str(o.notes),
      };
    })
    .filter((x): x is AnalystSetEntry => x !== null);
}

function normalizeAmbiguities(raw: unknown): AnalystAmbiguity[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((a): AnalystAmbiguity | null => {
      if (!a || typeof a !== "object") return null;
      const o = a as Record<string, unknown>;
      const issue = str(o.issue);
      if (!issue) return null;
      return {
        location: strOr(o.location, "unspecified"),
        issue,
        readings: Array.isArray(o.readings) ? o.readings.filter((x): x is string => typeof x === "string") : [],
      };
    })
    .filter((x): x is AnalystAmbiguity => x !== null);
}

function normalizeIntensityDistribution(raw: unknown, setByStepLog: AnalystSetEntry[]): Record<AnalystZone, number> {
  const fromModel = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hasAnyModelValue = ANALYST_ZONES.some((z) => num(fromModel[z]) !== null);
  if (hasAnyModelValue) {
    const out = {} as Record<AnalystZone, number>;
    for (const z of ANALYST_ZONES) out[z] = numOr0(fromModel[z]);
    return out;
  }
  // Model omitted or malformed the distribution -- derive it from the
  // per-set zones actually reported, rather than returning all-zero.
  const out = {} as Record<AnalystZone, number>;
  for (const z of ANALYST_ZONES) out[z] = 0;
  for (const set of setByStepLog) out[set.zone] += set.distanceM * set.sets;
  return out;
}

function buildUserMessage(rawText: string, previousSessions?: AnalystPreviousSession[]): string {
  let message = rawText;
  if (previousSessions && previousSessions.length > 0) {
    const context = previousSessions
      .map((s) => `${s.date}: "${s.sessionTitle}" -- ${s.totalDistanceM}m, primary focus: ${s.primaryFocus}`)
      .join("\n");
    message = `${message}\n\n---\n\nFor "Compare it with previous sessions if available" -- here are recent sessions for context:\n${context}`;
  }
  return `${message}\n\n${SWIM_SHORTHAND_RULES}`;
}

/** Runs the athlete's raw session text through The Analyst. Returns null if
 * Groq is unavailable, the call fails, or the response has no usable
 * set-by-set log -- callers should treat that as "analysis unavailable",
 * never as an empty/zero session. Never receives statedTotalDistanceM: the
 * parse must be derivable from rawText alone (WS4 §3). */
// WS4 §4b Task 1 -- fixed seed for reproducibility. Groq documents seed as
// best-effort (not a determinism guarantee), so this is paired with
// temperature 0 rather than relied on alone; the value itself is arbitrary,
// only its fixedness matters.
const ANALYST_SEED = 20260802;

export async function analyzeSwimSession(
  rawText: string,
  opts: { previousSessions?: AnalystPreviousSession[] } = {}
): Promise<AnalystResult | null> {
  const content = await callGroqChat(
    [
      { role: "system", content: `${ANALYST_SYSTEM_PROMPT}\n\n${JSON_SCHEMA_INSTRUCTIONS}` },
      { role: "user", content: buildUserMessage(rawText, opts.previousSessions) },
    ],
    { jsonMode: true, temperature: 0, seed: ANALYST_SEED, timeoutMs: 30_000 }
  );
  if (!content) return null;

  try {
    const raw = JSON.parse(content) as Record<string, unknown>;
    const setByStepLog = normalizeSetByStepLog(raw.setByStepLog);
    if (setByStepLog.length === 0) return null;

    const parsedDistanceM = setByStepLog.reduce((sum, s) => sum + s.distanceM * s.sets, 0);
    const overviewRaw = raw.overview && typeof raw.overview === "object" ? (raw.overview as Record<string, unknown>) : {};
    const trainingLoad = Math.max(1, Math.min(10, Math.round(numOr0(overviewRaw.trainingLoad) || 5)));

    const overview: AnalystOverview = {
      qualityDistanceM: numOr0(overviewRaw.qualityDistanceM),
      qualityPct: numOr0(overviewRaw.qualityPct),
      strokeBreakdownM: normalizeStringRecord(overviewRaw.strokeBreakdownM),
      equipmentBreakdownM: normalizeStringRecord(overviewRaw.equipmentBreakdownM),
      kickVolumeM: numOr0(overviewRaw.kickVolumeM),
      pullVolumeM: numOr0(overviewRaw.pullVolumeM),
      drillVolumeM: numOr0(overviewRaw.drillVolumeM),
      finsVolumeM: numOr0(overviewRaw.finsVolumeM),
      paddleVolumeM: numOr0(overviewRaw.paddleVolumeM),
      snorkelVolumeM: numOr0(overviewRaw.snorkelVolumeM),
      racePaceVolumeM: numOr0(overviewRaw.racePaceVolumeM),
      aerobicVolumeM: numOr0(overviewRaw.aerobicVolumeM),
      recoveryVolumeM: numOr0(overviewRaw.recoveryVolumeM),
      techniqueVolumeM: numOr0(overviewRaw.techniqueVolumeM),
      estimatedDurationMin: num(overviewRaw.estimatedDurationMin),
      trainingLoad,
      primaryEnergySystem: strOr(overviewRaw.primaryEnergySystem, "Unspecified"),
      primaryFocus: strOr(overviewRaw.primaryFocus, "Unspecified"),
    };

    return {
      sessionTitle: strOr(raw.sessionTitle, "Swim Session"),
      setByStepLog,
      parsedDistanceM,
      overview,
      intensityDistributionM: normalizeIntensityDistribution(raw.intensityDistributionM, setByStepLog),
      sessionAnalysis: strOr(raw.sessionAnalysis, ""),
      ambiguities: normalizeAmbiguities(raw.ambiguities),
    };
  } catch {
    return null;
  }
}
