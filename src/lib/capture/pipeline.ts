import { eq } from "drizzle-orm";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/db";
import {
  rawCaptures,
  swimSessions,
  swimTimes,
  workoutLogs,
  foodLogs,
  waterLogs,
  sleepLogs,
  weighIns,
  sorenessLogs,
  tasks,
  journalEntries,
  aiTakeaways,
  auditLog,
} from "@/lib/db/schema";
import { resolveExerciseByName } from "@/lib/db/queries";
import { rememberChunk } from "@/lib/memory/write";
import { syncCrmMirror } from "@/lib/crm/mirror";
import * as executors from "@/lib/capture/executors";
import { classify, ROUTE_PAYLOAD_SCHEMAS, type RouteKind, type Classification } from "@/lib/capture/classify";

export type { RouteKind, Classification };

export type PipelineResult = {
  status: "routed" | "failed";
  classification: Classification;
  routedTo: RouteKind[];
  routedIds: Partial<Record<RouteKind, number[]>>;
  errors: string[];
};

async function executeRoute(
  kind: RouteKind,
  payload: Record<string, unknown>,
  ctx: { captureId: number; source: "telegram" | "web"; classification: Classification }
): Promise<number | null> {
  switch (kind) {
    case "swim_session": {
      const p = ROUTE_PAYLOAD_SCHEMAS.swim_session.parse(payload);
      const row = await executors.logSwimSession({ loadRating: p.loadRating ?? 5, setsText: p.setsText });
      return row.id;
    }
    case "swim_time": {
      const p = ROUTE_PAYLOAD_SCHEMAS.swim_time.parse(payload);
      const row = await executors.logSwimTime({ event: p.event, timeMs: p.timeMs, meetName: p.meetName });
      return row.id;
    }
    case "gym_set": {
      // Capture-scoped resolver, not coach/tools.ts's today's-session-only
      // fuzzy match -- a capture can arrive well after the fact, so it
      // should resolve against the whole program the same way MCP's
      // log_workout_set does, not just what was scheduled today.
      const p = ROUTE_PAYLOAD_SCHEMAS.gym_set.parse(payload);
      const match = await resolveExerciseByName(p.exerciseName);
      if (!match) throw new Error(`no exercise found matching "${p.exerciseName}"`);
      const row = await executors.logGymSet({ exerciseId: match.id, weightKg: p.weightKg, reps: p.reps, rpe: p.rpe });
      return row.id;
    }
    case "meal": {
      const p = ROUTE_PAYLOAD_SCHEMAS.meal.parse(payload);
      const row = await executors.logMeal({
        description: p.description,
        kcal: p.kcal ?? 0,
        proteinG: p.proteinG ?? 0,
        carbsG: p.carbsG,
        fatG: p.fatG,
        timeSlot: p.timeSlot,
        source: "ai",
      });
      return row.id;
    }
    case "water": {
      const p = ROUTE_PAYLOAD_SCHEMAS.water.parse(payload);
      const row = await executors.logWater({ ml: p.ml });
      return row.id;
    }
    case "sleep": {
      const p = ROUTE_PAYLOAD_SCHEMAS.sleep.parse(payload);
      const row = await executors.logSleep({ hours: p.hours, bedtime: p.bedtime });
      return row.id;
    }
    case "weigh_in": {
      const p = ROUTE_PAYLOAD_SCHEMAS.weigh_in.parse(payload);
      const row = await executors.logWeighIn({ kg: p.kg });
      return row.id;
    }
    case "soreness": {
      const p = ROUTE_PAYLOAD_SCHEMAS.soreness.parse(payload);
      const row = await executors.logSoreness({ area: p.area, rating1to5: p.rating1to5 });
      return row.id;
    }
    case "task": {
      const p = ROUTE_PAYLOAD_SCHEMAS.task.parse(payload);
      const row = await executors.createTask({
        title: p.title,
        notes: p.notes,
        urgency: p.urgency ?? ctx.classification.urgency,
        rail: p.rail ?? "life",
        category: p.category,
        dueDate: p.dueDate,
        captureId: ctx.captureId,
      });
      return row.id;
    }
    case "journal": {
      // rawText carries the journal-relevant excerpt the classifier pulled
      // out (a capture can be journal + meal + swim at once, so this isn't
      // necessarily the whole transcript). transcript/summary stay null
      // here -- the full audio transcript already lives on the linked
      // raw_captures row via captureId, and generating an AI summary is a
      // separate Groq call Phase 2 doesn't ask this pipeline to make.
      const p = ROUTE_PAYLOAD_SCHEMAS.journal.parse(payload);
      const row = await executors.createJournalEntry({
        rawText: p.text,
        mood: p.mood,
        source: ctx.source,
        captureId: ctx.captureId,
      });
      return row.id;
    }
    case "note": {
      const p = ROUTE_PAYLOAD_SCHEMAS.note.parse(payload);
      await executors.createNote({ text: p.text });
      return null; // no row of its own -- see createNote's doc comment
    }
    case "coach_memory": {
      const p = ROUTE_PAYLOAD_SCHEMAS.coach_memory.parse(payload);
      const row = await executors.updateCoachMemory({ text: p.text });
      return row.id;
    }
  }
}

/**
 * Classify -> validate every payload with zod (dropping routes that fail,
 * recording why) -> execute each surviving route SEQUENTIALLY (never
 * Promise.all -- the connection pool is deliberately capped at 3, see
 * lib/db/index.ts) -> remember the capture in the vector store -> write an
 * audit row -> update the raw_captures row's own status. Caller has already
 * inserted the raw_captures row (so a crash before this still leaves the raw
 * text); this only ever updates it, never inserts.
 */
export async function runCapturePipeline(params: {
  captureId: number;
  text: string;
  source: "telegram" | "web";
}): Promise<PipelineResult> {
  const { captureId, text, source } = params;
  const classification = await classify(text);

  const routedTo: RouteKind[] = [];
  const routedIds: Partial<Record<RouteKind, number[]>> = {};
  const errors: string[] = [];

  for (const route of classification.routes) {
    const schema = ROUTE_PAYLOAD_SCHEMAS[route.kind];
    const parsed = schema.safeParse(route.payload);
    if (!parsed.success) {
      errors.push(`${route.kind}: invalid payload -- ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      continue;
    }
    try {
      const id = await executeRoute(route.kind, parsed.data, { captureId, source, classification });
      routedTo.push(route.kind);
      if (id !== null) (routedIds[route.kind] ??= []).push(id);
    } catch (err) {
      errors.push(`${route.kind}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Phase 3 §3a: "runs on CRM page load and after any capture" -- unconditional
  // (not just task-routed captures), same never-throws wrapping as the rest
  // of this block since a mirror-sync hiccup must not fail the capture.
  await syncCrmMirror().catch((err) => console.error(`runCapturePipeline: syncCrmMirror failed for capture ${captureId}`, err));

  // Never lets a failed embedding or a failed audit write take down the
  // whole capture -- rememberChunk already never throws on its own; the
  // auditLog insert is wrapped the same way here for the same reason.
  await rememberChunk({
    sourceType: "capture",
    sourceId: String(captureId),
    text,
    metadata: { routedTo, tags: classification.tags, source },
  }).catch((err) => console.error(`runCapturePipeline: rememberChunk failed for capture ${captureId}`, err));

  await db
    .insert(auditLog)
    .values({
      action: "capture_routed",
      resourceType: "raw_captures",
      resourceId: String(captureId),
      metadata: { routedTo, routedIds, errors },
    })
    .catch((err) => console.error(`runCapturePipeline: auditLog insert failed for capture ${captureId}`, err));

  const status: "routed" | "failed" = routedTo.length > 0 ? "routed" : "failed";
  await db
    .update(rawCaptures)
    .set({
      classification: classification as unknown as Record<string, unknown>,
      routedTo,
      routedIds,
      status,
      error: errors.length > 0 ? errors.join("; ") : null,
    })
    .where(eq(rawCaptures.id, captureId));

  if (routedTo.length > 0) {
    revalidateTag("analytics-data", { expire: 0 });
    revalidateTag("home-data", { expire: 0 });
  }

  return { status, classification, routedTo, routedIds, errors };
}

/** RouteKind -> the table its executor writes to, for undoCapture below.
 * 'note' has no table (see createNote's doc comment). */
async function deleteRoutedRow(kind: RouteKind, id: number): Promise<void> {
  switch (kind) {
    case "swim_session":
      await db.delete(swimSessions).where(eq(swimSessions.id, id));
      return;
    case "swim_time":
      await db.delete(swimTimes).where(eq(swimTimes.id, id));
      return;
    case "gym_set":
      await db.delete(workoutLogs).where(eq(workoutLogs.id, id));
      return;
    case "meal":
      await db.delete(foodLogs).where(eq(foodLogs.id, id));
      return;
    case "water":
      await db.delete(waterLogs).where(eq(waterLogs.id, id));
      return;
    case "sleep":
      await db.delete(sleepLogs).where(eq(sleepLogs.id, id));
      return;
    case "weigh_in":
      await db.delete(weighIns).where(eq(weighIns.id, id));
      return;
    case "soreness":
      await db.delete(sorenessLogs).where(eq(sorenessLogs.id, id));
      return;
    case "task":
      await db.delete(tasks).where(eq(tasks.id, id));
      return;
    case "journal":
      await db.delete(journalEntries).where(eq(journalEntries.id, id));
      return;
    case "coach_memory":
      await db.delete(aiTakeaways).where(eq(aiTakeaways.id, id));
      return;
    case "note":
      return;
  }
}

/** Deletes exactly what a capture wrote (via its stored routedIds) and marks
 * it discarded. Idempotent -- undoing an already-discarded capture is a no-op. */
export async function undoCapture(captureId: number): Promise<{ ok: boolean; error?: string }> {
  const [capture] = await db.select().from(rawCaptures).where(eq(rawCaptures.id, captureId)).limit(1);
  if (!capture) return { ok: false, error: "capture not found" };
  if (capture.status === "discarded") return { ok: true };

  const routedIds = (capture.routedIds ?? {}) as Partial<Record<RouteKind, number[]>>;
  for (const kind of Object.keys(routedIds) as RouteKind[]) {
    for (const id of routedIds[kind] ?? []) {
      await deleteRoutedRow(kind, id);
    }
  }

  await db.update(rawCaptures).set({ status: "discarded" }).where(eq(rawCaptures.id, captureId));
  revalidateTag("analytics-data", { expire: 0 });
  revalidateTag("home-data", { expire: 0 });
  return { ok: true };
}

