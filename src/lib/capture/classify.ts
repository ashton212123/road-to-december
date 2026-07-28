import { z } from "zod";
import { callGroqChat } from "@/lib/ai/groq";
import { todayManilaISO } from "@/lib/time";

export const ROUTE_KINDS = [
  "swim_session",
  "swim_time",
  "gym_set",
  "meal",
  "water",
  "sleep",
  "weigh_in",
  "soreness",
  "task",
  "journal",
  "note",
  "coach_memory",
] as const;

export type RouteKind = (typeof ROUTE_KINDS)[number];
export type Urgency = "today" | "week" | "month" | "someday";

export type Route = { kind: RouteKind; payload: Record<string, unknown>; confidence: number };
export type Classification = { routes: Route[]; summary: string; urgency: Urgency; tags: string[] };

/**
 * One zod schema per RouteKind, validated before a route reaches its
 * executor (capture/pipeline.ts). Fields the executors treat as required
 * (loadRating, kcal, proteinG, urgency, rail...) are optional *here* with
 * sensible defaults -- the regex/keyword fallback below can only ever
 * produce a bare description/title/text, never a real macro or load
 * estimate, and a route must still validate in that case rather than being
 * dropped for missing what only Groq could have filled in.
 */
export const ROUTE_PAYLOAD_SCHEMAS = {
  swim_session: z.object({
    loadRating: z.number().min(1).max(10).optional(),
    setsText: z.string().optional(),
  }),
  swim_time: z.object({
    event: z.string().min(1),
    timeMs: z.number().positive(),
    meetName: z.string().optional(),
  }),
  gym_set: z.object({
    exerciseName: z.string().min(1),
    weightKg: z.number().optional(),
    reps: z.number().optional(),
    rpe: z.number().optional(),
  }),
  meal: z.object({
    description: z.string().min(1),
    kcal: z.number().nonnegative().optional(),
    proteinG: z.number().nonnegative().optional(),
    carbsG: z.number().nonnegative().optional(),
    fatG: z.number().nonnegative().optional(),
    timeSlot: z.string().optional(),
  }),
  water: z.object({ ml: z.number().positive() }),
  sleep: z.object({ hours: z.number().positive(), bedtime: z.string().optional() }),
  weigh_in: z.object({ kg: z.number().positive() }),
  soreness: z.object({ area: z.string().min(1), rating1to5: z.number().min(1).max(5) }),
  task: z.object({
    title: z.string().min(1),
    notes: z.string().optional(),
    urgency: z.enum(["today", "week", "month", "someday"]).optional(),
    rail: z.enum(["life", "athlete"]).optional(),
    category: z.string().optional(),
    dueDate: z.string().optional(),
  }),
  journal: z.object({ text: z.string().min(1), mood: z.number().min(1).max(5).optional() }),
  note: z.object({ text: z.string().min(1) }),
  coach_memory: z.object({ text: z.string().min(1) }),
} as const satisfies Record<RouteKind, z.ZodType>;

const SYSTEM_PROMPT = `You classify a voice/text capture from a competitive teenage swimmer's personal logging app. His goal meet is in December. Today's date is ${todayManilaISO()}.

Read the capture and decide which of these route kinds it describes. A single capture can produce MULTIPLE routes -- e.g. "swam 6x100 free on 1:30, felt heavy, then chicken and rice" is a swim_session AND a soreness AND a meal, three routes from one capture.

Route kinds and their payload fields:
- swim_session: { loadRating: 1-10, setsText: string } -- a training swim session
- swim_time: { event: string (e.g. "200 Breast"), timeMs: number, meetName?: string } -- a race/time-trial result
- gym_set: { exerciseName: string, weightKg?: number, reps?: number, rpe?: number } -- one logged gym set
- meal: { description: string, kcal?: number, proteinG?: number, carbsG?: number, fatG?: number, timeSlot?: string } -- estimate kcal/protein/carbs/fat yourself from the food described
- water: { ml: number }
- sleep: { hours: number, bedtime?: string "HH:MM" }
- weigh_in: { kg: number }
- soreness: { area: string, rating1to5: 1-5 }
- task: { title: string, notes?: string, urgency?: "today"|"week"|"month"|"someday", rail?: "life"|"athlete", category?: string, dueDate?: "YYYY-MM-DD" }
- journal: { text: string, mood?: 1-5 } -- a reflective/diary-style entry about the day
- note: { text: string } -- anything that doesn't fit another kind, so nothing is ever lost
- coach_memory: { text: string } -- an explicit instruction to remember something about the athlete long-term (preferences, constraints, injury history)

Return ONLY JSON, no prose, matching exactly:
{ "routes": [{ "kind": "...", "payload": {...}, "confidence": 0-1 }], "summary": "one line", "urgency": "today"|"week"|"month"|"someday", "tags": ["..."] }

If you are not confident a route applies, give it a low confidence (below 0.5) rather than guessing or omitting it entirely -- the pipeline decides what to do with low-confidence routes. "urgency" and "tags" describe the capture as a whole (used as defaults, e.g. for a task route that doesn't specify its own urgency).`;

function truncatedSummary(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 100 ? `${trimmed.slice(0, 97)}...` : trimmed;
}

/** `/\b\d+x\d+\b/` (e.g. "10x100") -> swim, "ate"/"had" -> meal, "remind"/"need to"/"todo" -> task,
 * else -> note. No AI available at this point, so payloads are bare text only -- see the schemas
 * above for why that's still valid. Last-resort path: must never throw, must always return a route. */
function regexFallbackClassify(text: string): Classification {
  const lower = text.toLowerCase();
  const summary = truncatedSummary(text);

  if (/\b\d+x\d+\b/.test(lower)) {
    return { routes: [{ kind: "swim_session", payload: { setsText: text }, confidence: 0.3 }], summary, urgency: "someday", tags: [] };
  }
  if (/\b(ate|had)\b/.test(lower)) {
    return { routes: [{ kind: "meal", payload: { description: text }, confidence: 0.3 }], summary, urgency: "someday", tags: [] };
  }
  if (/\b(remind|need to|todo)\b/.test(lower)) {
    return { routes: [{ kind: "task", payload: { title: text.slice(0, 200) }, confidence: 0.3 }], summary, urgency: "someday", tags: [] };
  }
  return { routes: [{ kind: "note", payload: { text }, confidence: 0.1 }], summary, urgency: "someday", tags: [] };
}

function isRouteKind(value: unknown): value is RouteKind {
  return typeof value === "string" && (ROUTE_KINDS as readonly string[]).includes(value);
}

/** Best-effort shape check on Groq's raw JSON -- real per-kind field validation happens later
 * in the pipeline via ROUTE_PAYLOAD_SCHEMAS, this just guards against a malformed top-level shape. */
function parseGroqClassification(raw: string): Classification | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const obj = data as Record<string, unknown>;
  if (!Array.isArray(obj.routes)) return null;

  const routes: Route[] = [];
  for (const r of obj.routes) {
    if (typeof r !== "object" || r === null) continue;
    const route = r as Record<string, unknown>;
    if (!isRouteKind(route.kind)) continue;
    const payload = typeof route.payload === "object" && route.payload !== null ? (route.payload as Record<string, unknown>) : {};
    const confidence = typeof route.confidence === "number" ? route.confidence : 0.5;
    routes.push({ kind: route.kind, payload, confidence });
  }
  if (routes.length === 0) return null;

  const urgency: Urgency = ["today", "week", "month", "someday"].includes(obj.urgency as string)
    ? (obj.urgency as Urgency)
    : "someday";
  const tags = Array.isArray(obj.tags) ? obj.tags.filter((t): t is string => typeof t === "string") : [];
  const summary = typeof obj.summary === "string" && obj.summary.trim() ? obj.summary.trim() : routes.map((r) => r.kind).join(", ");

  return { routes, summary, urgency, tags };
}

/**
 * Classifies a capture's text into one or more routes. Fallback chain:
 * Groq (JSON mode) -> regex/keyword matcher -> a single 'note' route --
 * something is always returned, nothing is ever lost. Never throws.
 */
export async function classify(text: string): Promise<Classification> {
  try {
    const raw = await callGroqChat(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text },
      ],
      { jsonMode: true, temperature: 0.2 }
    );
    if (raw) {
      const parsed = parseGroqClassification(raw);
      if (parsed) return parsed;
    }
  } catch {
    // fall through to the regex fallback
  }
  return regexFallbackClassify(text);
}
