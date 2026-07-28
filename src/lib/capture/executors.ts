import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  swimSessions,
  swimTimes,
  workoutLogs,
  foodLogs,
  waterLogs,
  sleepLogs,
  weighIns,
  sorenessLogs,
  aiTakeaways,
  tasks,
  journalEntries,
} from "@/lib/db/schema";
import { todayManilaISO } from "@/lib/time";

/**
 * Pure DB-write executors, one per write operation the coach tool loop, the
 * MCP server, and the capture pipeline all need. Each does only the core
 * "compute + insert/update" -- name resolution (which exercise/business a
 * free-text name means), input validation, cache revalidation, and response
 * formatting all stay with each caller, because those genuinely differ
 * between callers (e.g. the coach only matches today's scheduled exercises,
 * MCP's resolveExerciseByName searches more broadly) and folding them in
 * here would change behavior the refactor is required to preserve exactly.
 */

// ---------- Swim ----------

export async function logSwimSession(p: { loadRating: number; setsText?: string | null; date?: string }) {
  const [row] = await db
    .insert(swimSessions)
    .values({
      date: p.date ?? todayManilaISO(),
      loadRating: Math.min(10, Math.max(1, Math.round(p.loadRating))),
      setsText: p.setsText ?? null,
      parsedDistanceM: null,
    })
    .returning();
  return row;
}

export async function logSwimTime(p: {
  event: string;
  timeMs: number;
  meetName?: string | null;
  course?: "SCM" | "LCM" | null;
  splits?: number[] | null;
  strokeCounts?: number[] | null;
  date?: string;
}) {
  const [row] = await db
    .insert(swimTimes)
    .values({
      date: p.date ?? todayManilaISO(),
      event: p.event,
      timeMs: Math.round(p.timeMs),
      meetName: p.meetName ?? null,
      course: p.course ?? null,
      splits: p.splits ?? null,
      strokeCounts: p.strokeCounts ?? null,
    })
    .returning();
  return row;
}

// ---------- Gym ----------

/** Caller has already resolved `exerciseId` (matching scope differs by caller -- see file header). */
export async function logGymSet(p: {
  exerciseId: number;
  weightKg?: number | null;
  reps?: number | null;
  rpe?: number | null;
  date?: string;
}) {
  const date = p.date ?? todayManilaISO();
  const priorSets = await db
    .select({ setNumber: workoutLogs.setNumber })
    .from(workoutLogs)
    .where(and(eq(workoutLogs.date, date), eq(workoutLogs.exerciseId, p.exerciseId)));
  const [row] = await db
    .insert(workoutLogs)
    .values({
      date,
      exerciseId: p.exerciseId,
      setNumber: priorSets.length + 1,
      weightKg: p.weightKg !== undefined && p.weightKg !== null ? String(p.weightKg) : null,
      reps: p.reps ?? null,
      rpe: p.rpe !== undefined && p.rpe !== null ? String(p.rpe) : null,
      restSeconds: null,
      notes: null,
    })
    .returning();
  return row;
}

// ---------- Fuel ----------

/** One food-log row. Batch logging (multiple foods in one call) stays as its
 * own optimized multi-row insert in mcp/route.ts's log_meal tool -- routing
 * it through this per-row executor would turn one batched insert into N
 * sequential round trips against the deliberately tiny connection pool. */
export async function logMeal(p: {
  description: string;
  kcal: number;
  proteinG: number;
  carbsG?: number | null;
  fatG?: number | null;
  timeSlot?: string;
  date?: string;
  source?: string;
}) {
  const [row] = await db
    .insert(foodLogs)
    .values({
      date: p.date ?? todayManilaISO(),
      timeSlot: p.timeSlot ?? "snack",
      description: p.description,
      kcal: Math.round(p.kcal),
      proteinG: String(p.proteinG),
      carbsG: p.carbsG !== undefined && p.carbsG !== null ? String(p.carbsG) : null,
      fatG: p.fatG !== undefined && p.fatG !== null ? String(p.fatG) : null,
      source: p.source ?? "manual",
    })
    .returning();
  return row;
}

export async function logWater(p: { ml: number; date?: string }) {
  const [row] = await db
    .insert(waterLogs)
    .values({ date: p.date ?? todayManilaISO(), ml: Math.round(p.ml) })
    .returning();
  return row;
}

// ---------- Sleep / body ----------

export async function logSleep(p: { hours: number; bedtime?: string | null; onTime?: boolean | null; date?: string }) {
  const [row] = await db
    .insert(sleepLogs)
    .values({
      date: p.date ?? todayManilaISO(),
      hours: String(p.hours),
      bedtime: p.bedtime ?? null,
      onTime: p.onTime ?? null,
    })
    .returning();
  return row;
}

export async function logWeighIn(p: { kg: number; date?: string }) {
  const date = p.date ?? todayManilaISO();
  const [row] = await db
    .insert(weighIns)
    .values({ date, kg: String(p.kg) })
    .onConflictDoUpdate({ target: weighIns.date, set: { kg: String(p.kg) } })
    .returning();
  return row;
}

export async function logSoreness(p: { area: string; rating1to5: number; date?: string }) {
  const [row] = await db
    .insert(sorenessLogs)
    .values({
      date: p.date ?? todayManilaISO(),
      rating1to5: Math.round(p.rating1to5),
      area: p.area,
    })
    .returning();
  return row;
}

// ---------- Coach memory ----------

export async function updateCoachMemory(p: { text: string }) {
  const today = todayManilaISO();
  const text = p.text.trim().slice(0, 900);
  const [row] = await db
    .insert(aiTakeaways)
    .values({ date: today, key: "athlete-model", message: text })
    .onConflictDoUpdate({ target: [aiTakeaways.date, aiTakeaways.key], set: { message: text } })
    .returning();
  return row;
}

// ---------- Personal OS: tasks / journal / notes (capture pipeline only, no prior caller) ----------

export async function createTask(p: {
  title: string;
  notes?: string | null;
  urgency: "today" | "week" | "month" | "someday";
  rail: "life" | "athlete";
  category?: string | null;
  isKey?: boolean;
  dueDate?: string | null;
  tags?: string[] | null;
  timeEstimateMin?: number | null;
  captureId?: number | null;
}) {
  const [row] = await db
    .insert(tasks)
    .values({
      title: p.title,
      notes: p.notes ?? null,
      urgency: p.urgency,
      rail: p.rail,
      category: p.category ?? null,
      isKey: p.isKey ?? false,
      dueDate: p.dueDate ?? null,
      tags: p.tags ?? null,
      timeEstimateMin: p.timeEstimateMin ?? null,
      sourceKind: p.captureId ? "capture" : "manual",
      captureId: p.captureId ?? null,
    })
    .returning();
  return row;
}

export async function createJournalEntry(p: {
  entryDate?: string;
  rawText?: string | null;
  transcript?: string | null;
  summary?: string | null;
  mood?: number | null;
  tags?: string[] | null;
  source: "telegram" | "web";
  captureId?: number | null;
}) {
  const [row] = await db
    .insert(journalEntries)
    .values({
      entryDate: p.entryDate ?? todayManilaISO(),
      rawText: p.rawText ?? null,
      transcript: p.transcript ?? null,
      summary: p.summary ?? null,
      mood: p.mood ?? null,
      tags: p.tags ?? null,
      source: p.source,
      captureId: p.captureId ?? null,
    })
    .returning();
  return row;
}

/**
 * A "note" capture needs no table of its own -- the raw_captures row already
 * inserted for it before classification (see capture/pipeline.ts) is the
 * durable record, and the capture-level rememberChunk call already makes it
 * searchable in the Brain. This exists so RouteKind 'note' has a handler
 * symmetric with every other route, not because a note needs its own storage.
 */
export async function createNote(_p: { text: string }): Promise<{ ok: true }> {
  return { ok: true };
}
