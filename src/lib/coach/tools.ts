import { revalidatePath, updateTag } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  waterLogs,
  foodLogs,
  sleepLogs,
  weighIns,
  sorenessLogs,
  swimSessions,
  swimTimes,
  workoutLogs,
  settings,
} from "@/lib/db/schema";
import { getAllPhasesWithSessions, getCurrentPhase, getFoodLogsForDate, getWaterLogsForDate, getWorkoutLogsSince, getSwimTimes } from "@/lib/db/queries";
import { todayManilaISO, todayDayKey } from "@/lib/time";
import { withFallback } from "@/lib/db/withFallback";
import type { GroqToolDef } from "@/lib/ai/groq";
import * as executors from "@/lib/capture/executors";

/** Every write mutation here mirrors the exact db operation + revalidation
 * its equivalent server action performs (fuel/actions.ts, more/actions.ts,
 * train/actions.ts, analytics/actions.ts) -- deliberately not importing
 * those "use server" files directly, per the plan, so this stays a plain
 * data-layer module the tool loop can call synchronously without crossing
 * a client/server action boundary that doesn't apply here anyway. */

function revalidateFuelAndHome() {
  revalidatePath("/fuel");
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

async function todaysSessionExercises(): Promise<{ id: number; name: string }[]> {
  const allPhases = await getAllPhasesWithSessions();
  const today = todayManilaISO();
  const currentPhase = getCurrentPhase(allPhases, today) ?? allPhases[0];
  const session = currentPhase?.sessions.find((s) => s.dayKey === todayDayKey());
  return session?.exercises.map((e) => ({ id: e.id, name: e.name })) ?? [];
}

// Same matching logic as ImportSessionButton's fuzzyMatchId -- exact match
// first, then substring either direction.
function fuzzyMatchExercise(name: string, exercises: { id: number; name: string }[]): { id: number; name: string } | null {
  const norm = name.toLowerCase().trim();
  const exact = exercises.find((e) => e.name.toLowerCase() === norm);
  if (exact) return exact;
  const partial = exercises.find((e) => e.name.toLowerCase().includes(norm) || norm.includes(e.name.toLowerCase()));
  return partial ?? null;
}

type UndoKind = "water" | "meal" | "sleep" | "weigh_in" | "soreness" | "swim_session" | "swim_time" | "gym_set";

async function undoMostRecentToday(kind: UndoKind): Promise<string> {
  const today = todayManilaISO();
  switch (kind) {
    case "water": {
      const [row] = await db.select().from(waterLogs).where(eq(waterLogs.date, today)).orderBy(desc(waterLogs.id)).limit(1);
      if (!row) return JSON.stringify({ error: "nothing logged today to undo" });
      await db.delete(waterLogs).where(eq(waterLogs.id, row.id));
      revalidateFuelAndHome();
      return JSON.stringify({ ok: true, undone: `${row.ml}ml water` });
    }
    case "meal": {
      const [row] = await db.select().from(foodLogs).where(eq(foodLogs.date, today)).orderBy(desc(foodLogs.id)).limit(1);
      if (!row) return JSON.stringify({ error: "nothing logged today to undo" });
      await db.delete(foodLogs).where(eq(foodLogs.id, row.id));
      revalidateFuelAndHome();
      return JSON.stringify({ ok: true, undone: row.description });
    }
    case "sleep": {
      const [row] = await db.select().from(sleepLogs).where(eq(sleepLogs.date, today)).orderBy(desc(sleepLogs.id)).limit(1);
      if (!row) return JSON.stringify({ error: "nothing logged today to undo" });
      await db.delete(sleepLogs).where(eq(sleepLogs.id, row.id));
      revalidatePath("/more/recovery");
      revalidatePath("/home");
      updateTag("analytics-data");
      updateTag("home-data");
      return JSON.stringify({ ok: true, undone: `${row.hours}h sleep` });
    }
    case "weigh_in": {
      const [row] = await db.select().from(weighIns).where(eq(weighIns.date, today)).limit(1);
      if (!row) return JSON.stringify({ error: "nothing logged today to undo" });
      await db.delete(weighIns).where(eq(weighIns.id, row.id));
      revalidateFuelAndHome();
      revalidatePath("/analytics");
      return JSON.stringify({ ok: true, undone: `${row.kg}kg weigh-in` });
    }
    case "soreness": {
      const [row] = await db.select().from(sorenessLogs).where(eq(sorenessLogs.date, today)).orderBy(desc(sorenessLogs.id)).limit(1);
      if (!row) return JSON.stringify({ error: "nothing logged today to undo" });
      await db.delete(sorenessLogs).where(eq(sorenessLogs.id, row.id));
      revalidatePath("/more/recovery");
      updateTag("analytics-data");
      return JSON.stringify({ ok: true, undone: `${row.area} soreness ${row.rating1to5}/5` });
    }
    case "swim_session": {
      const [row] = await db.select().from(swimSessions).where(eq(swimSessions.date, today)).orderBy(desc(swimSessions.id)).limit(1);
      if (!row) return JSON.stringify({ error: "nothing logged today to undo" });
      await db.delete(swimSessions).where(eq(swimSessions.id, row.id));
      revalidatePath("/analytics");
      revalidatePath("/swim");
      revalidatePath("/home");
      updateTag("analytics-data");
      updateTag("home-data");
      return JSON.stringify({ ok: true, undone: "today's swim session" });
    }
    case "swim_time": {
      const [row] = await db.select().from(swimTimes).where(eq(swimTimes.date, today)).orderBy(desc(swimTimes.id)).limit(1);
      if (!row) return JSON.stringify({ error: "nothing logged today to undo" });
      await db.delete(swimTimes).where(eq(swimTimes.id, row.id));
      revalidatePath("/analytics");
      revalidatePath("/swim");
      updateTag("analytics-data");
      updateTag("home-data");
      return JSON.stringify({ ok: true, undone: `${row.event} time` });
    }
    case "gym_set": {
      const [row] = await db.select().from(workoutLogs).where(eq(workoutLogs.date, today)).orderBy(desc(workoutLogs.id)).limit(1);
      if (!row) return JSON.stringify({ error: "nothing logged today to undo" });
      await db.delete(workoutLogs).where(eq(workoutLogs.id, row.id));
      revalidatePath("/train", "layout");
      revalidatePath("/home");
      updateTag("analytics-data");
      updateTag("home-data");
      return JSON.stringify({ ok: true, undone: `set ${row.setNumber} (exercise #${row.exerciseId})` });
    }
  }
}

export const COACH_TOOLS: GroqToolDef[] = [
  {
    type: "function",
    function: {
      name: "log_water",
      description: "Log a water intake amount for today.",
      parameters: { type: "object", properties: { ml: { type: "number", description: "Amount in milliliters" } }, required: ["ml"] },
    },
  },
  {
    type: "function",
    function: {
      name: "log_meal",
      description: "Log a meal/food item for today.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Short description of the food" },
          kcal: { type: "number" },
          protein_g: { type: "number" },
        },
        required: ["name", "kcal", "protein_g"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_sleep",
      description: "Log last night's sleep duration.",
      parameters: { type: "object", properties: { hours: { type: "number" } }, required: ["hours"] },
    },
  },
  {
    type: "function",
    function: {
      name: "log_weigh_in",
      description: "Log today's bodyweight.",
      parameters: { type: "object", properties: { kg: { type: "number" } }, required: ["kg"] },
    },
  },
  {
    type: "function",
    function: {
      name: "log_soreness",
      description: "Log muscle soreness for today.",
      parameters: {
        type: "object",
        properties: { area: { type: "string" }, rating_1_5: { type: "number", description: "1 (none) to 5 (severe)" } },
        required: ["area", "rating_1_5"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_swim_session",
      description: "Log today's swim training session from a free-text description of the sets.",
      parameters: {
        type: "object",
        properties: {
          raw_text: { type: "string", description: "The sets as described, e.g. '10x100 BR @1:30, main set 6x200 IM'" },
          load_rating: { type: "number", description: "Subjective session load 1 (easy) to 10 (max effort)" },
        },
        required: ["raw_text", "load_rating"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_swim_time",
      description: "Log a swim time for a specific event.",
      parameters: {
        type: "object",
        properties: {
          event: { type: "string", description: "e.g. '50 Breast', '200 IM'" },
          time_seconds: { type: "number" },
          meet_name: { type: "string", description: "Optional meet name if this was raced, omit for a practice time" },
        },
        required: ["event", "time_seconds"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "log_gym_set",
      description: "Log one completed set for an exercise in today's scheduled gym session.",
      parameters: {
        type: "object",
        properties: {
          exercise_name: { type: "string", description: "Must match (or closely match) an exercise in today's session" },
          weight_kg: { type: "number", description: "Omit for bodyweight exercises" },
          reps: { type: "number" },
          rpe: { type: "number", description: "Optional, 1-10" },
        },
        required: ["exercise_name", "reps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_water_target",
      description: "Change the daily water target.",
      parameters: { type: "object", properties: { ml: { type: "number" } }, required: ["ml"] },
    },
  },
  {
    type: "function",
    function: {
      name: "update_training_status",
      description: "Change training status (e.g. when sick, injured, or on a break -- excuses missed sessions with zero pressure).",
      parameters: {
        type: "object",
        properties: { status: { type: "string", enum: ["healthy", "sick", "injured", "break"] } },
        required: ["status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_coach_memory",
      description: "Update the persistent athlete model the coach remembers across conversations (preferences, constraints, injury history, etc).",
      parameters: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    },
  },
  {
    type: "function",
    function: {
      name: "undo_last",
      description: "Undo the most recently logged item of a given kind, today only.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["water", "meal", "sleep", "weigh_in", "soreness", "swim_session", "swim_time", "gym_set"] },
        },
        required: ["kind"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_today_summary",
      description: "Read today's logged fuel, water, gym sets, and swim activity -- use this before answering questions about what's been logged today rather than guessing.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function executeCoachTool(name: string, args: Record<string, unknown>): Promise<string> {
  const today = todayManilaISO();

  switch (name) {
    case "log_water": {
      const ml = Number(args.ml);
      if (!Number.isFinite(ml) || ml <= 0) return JSON.stringify({ error: "ml must be a positive number" });
      await executors.logWater({ ml, date: today });
      revalidateFuelAndHome();
      const total = (await getWaterLogsForDate(today)).reduce((s, w) => s + w.ml, 0);
      return JSON.stringify({ ok: true, logged: `${Math.round(ml)}ml water`, totalToday: `${(total / 1000).toFixed(2)}L` });
    }

    case "log_meal": {
      const kcal = Number(args.kcal);
      const proteinG = Number(args.protein_g);
      const description = String(args.name ?? "").trim();
      if (!description) return JSON.stringify({ error: "name is required" });
      await executors.logMeal({
        description,
        kcal: Math.round(kcal) || 0,
        proteinG: Number.isFinite(proteinG) ? proteinG : 0,
        timeSlot: "snack",
        date: today,
        source: "ai",
      });
      revalidateFuelAndHome();
      return JSON.stringify({ ok: true, logged: `${description} (${Math.round(kcal)} kcal, ${proteinG}g protein)` });
    }

    case "log_sleep": {
      const hours = Number(args.hours);
      if (!Number.isFinite(hours) || hours <= 0) return JSON.stringify({ error: "hours must be a positive number" });
      await executors.logSleep({ hours, date: today });
      revalidatePath("/more/recovery");
      revalidatePath("/home");
      updateTag("analytics-data");
      updateTag("home-data");
      return JSON.stringify({ ok: true, logged: `${hours}h sleep` });
    }

    case "log_weigh_in": {
      const kg = Number(args.kg);
      if (!Number.isFinite(kg) || kg <= 0) return JSON.stringify({ error: "kg must be a positive number" });
      await executors.logWeighIn({ kg, date: today });
      revalidateFuelAndHome();
      revalidatePath("/analytics");
      return JSON.stringify({ ok: true, logged: `${kg}kg` });
    }

    case "log_soreness": {
      const rating = Math.round(Number(args.rating_1_5));
      const area = String(args.area ?? "").trim();
      if (!area) return JSON.stringify({ error: "area is required" });
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) return JSON.stringify({ error: "rating_1_5 must be 1-5" });
      await executors.logSoreness({ area, rating1to5: rating, date: today });
      revalidatePath("/more/recovery");
      updateTag("analytics-data");
      return JSON.stringify({ ok: true, logged: `${area} soreness ${rating}/5` });
    }

    case "log_swim_session": {
      const rawText = String(args.raw_text ?? "").trim();
      const loadRating = Math.round(Number(args.load_rating)) || 5;
      if (!rawText) return JSON.stringify({ error: "raw_text is required" });
      // No auto-distance-estimate here -- the regex parser that used to
      // guess a total from raw_text is retired (loop 33); this coach-tool
      // path logs load + text only, same as before AI-first swim logging
      // existed. Use the Log tab for a session with a real distance total.
      await executors.logSwimSession({ loadRating, setsText: rawText, date: today });
      revalidatePath("/analytics");
      revalidatePath("/swim");
      revalidatePath("/home");
      updateTag("analytics-data");
      updateTag("home-data");
      return JSON.stringify({ ok: true, logged: "swim session" });
    }

    case "log_swim_time": {
      const event = String(args.event ?? "").trim();
      const timeSeconds = Number(args.time_seconds);
      if (!event) return JSON.stringify({ error: "event is required" });
      if (!Number.isFinite(timeSeconds) || timeSeconds <= 0) return JSON.stringify({ error: "time_seconds must be a positive number" });
      await executors.logSwimTime({
        event,
        timeMs: Math.round(timeSeconds * 1000),
        meetName: args.meet_name ? String(args.meet_name) : null,
        date: today,
      });
      revalidatePath("/analytics");
      revalidatePath("/swim");
      updateTag("analytics-data");
      updateTag("home-data");
      return JSON.stringify({ ok: true, logged: `${event} in ${timeSeconds}s` });
    }

    case "log_gym_set": {
      const exerciseName = String(args.exercise_name ?? "").trim();
      const reps = Math.round(Number(args.reps));
      if (!exerciseName) return JSON.stringify({ error: "exercise_name is required" });
      const todayExercises = await todaysSessionExercises();
      const matched = fuzzyMatchExercise(exerciseName, todayExercises);
      if (!matched) {
        return JSON.stringify({
          error: `no exercise named "${exerciseName}" in today's session`,
          options: todayExercises.map((e) => e.name),
        });
      }
      const weightKg = args.weight_kg !== undefined && args.weight_kg !== null ? Number(args.weight_kg) : null;
      const rpe = args.rpe !== undefined && args.rpe !== null ? Number(args.rpe) : null;
      await executors.logGymSet({
        exerciseId: matched.id,
        weightKg,
        reps: Number.isFinite(reps) ? reps : null,
        rpe,
        date: today,
      });
      revalidatePath("/train", "layout");
      revalidatePath("/home");
      updateTag("analytics-data");
      updateTag("home-data");
      return JSON.stringify({ ok: true, logged: `${matched.name}: ${weightKg ?? "bodyweight"}${weightKg !== null ? "kg" : ""} x ${reps}` });
    }

    case "update_water_target": {
      const ml = Math.round(Number(args.ml));
      if (!Number.isFinite(ml) || ml <= 0) return JSON.stringify({ error: "ml must be a positive number" });
      await db.update(settings).set({ waterTargetMl: ml }).where(eq(settings.id, "singleton"));
      revalidatePath("/", "layout");
      updateTag("analytics-data");
      updateTag("home-data");
      return JSON.stringify({ ok: true, updated: `water target set to ${ml}ml` });
    }

    case "update_training_status": {
      const status = String(args.status ?? "");
      if (!["healthy", "sick", "injured", "break"].includes(status)) return JSON.stringify({ error: "invalid status" });
      await db
        .update(settings)
        .set({ trainingStatus: status as "healthy" | "sick" | "injured" | "break", trainingStatusSince: status === "healthy" ? null : today })
        .where(eq(settings.id, "singleton"));
      revalidatePath("/", "layout");
      updateTag("analytics-data");
      updateTag("home-data");
      return JSON.stringify({ ok: true, updated: `training status set to ${status}` });
    }

    case "update_coach_memory": {
      const text = String(args.text ?? "").trim().slice(0, 900);
      if (!text) return JSON.stringify({ error: "text is required" });
      await executors.updateCoachMemory({ text });
      revalidatePath("/more/settings");
      return JSON.stringify({ ok: true, updated: "coach memory" });
    }

    case "undo_last": {
      const kind = String(args.kind ?? "") as UndoKind;
      return undoMostRecentToday(kind);
    }

    case "get_today_summary": {
      // Same tiny-pool starvation risk as getCoachAppContext's 9-way
      // Promise.all (see lib/db/withFallback.ts) -- this fires 5 more
      // queries at once, so it gets the same protection.
      const [food, water, workouts, swimTimesRows, todaysSwimSession] = await Promise.all([
        withFallback(getFoodLogsForDate(today), []),
        withFallback(getWaterLogsForDate(today), []),
        withFallback(getWorkoutLogsSince(today), []),
        withFallback(getSwimTimes(10), []),
        withFallback(
          db.select().from(swimSessions).where(eq(swimSessions.date, today)).orderBy(desc(swimSessions.id)).limit(1).then((r) => r[0] ?? null),
          null
        ),
      ]);
      const todaysSwimTimes = swimTimesRows.filter((s) => s.date === today);
      return JSON.stringify({
        kcalToday: food.reduce((s, f) => s + f.kcal, 0),
        proteinGToday: food.reduce((s, f) => s + Number(f.proteinG), 0),
        meals: food.map((f) => f.description),
        waterMl: water.reduce((s, w) => s + w.ml, 0),
        gymSetsLogged: workouts.filter((w) => w.date === today).length,
        swimSessionLogged: Boolean(todaysSwimSession),
        swimTimesLogged: todaysSwimTimes.map((s) => s.event),
      });
    }

    default:
      return JSON.stringify({ error: `unknown tool: ${name}` });
  }
}
