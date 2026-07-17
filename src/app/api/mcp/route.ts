import { timingSafeEqual } from "crypto";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { db } from "@/lib/db";
import {
  workoutLogs,
  weighIns,
  sleepLogs,
  waterLogs,
  foodLogs,
  swimTimes,
  cmjTests,
  jumpTests,
  sorenessLogs,
  timeTo15m,
  settings,
  businessTransactions,
  businessTasks,
  swimSessions,
} from "@/lib/db/schema";
import { todayManilaISO, daysBetween, addDaysISO, todayDayKey, manilaHourNow } from "@/lib/time";
import { seasonData } from "@/lib/data/season-data";
import {
  getAllPhasesWithSessions,
  getCurrentPhase,
  getLatestWeighIn,
  getWeighIns,
  getFoodLogsForDate,
  getWaterLogsForDate,
  getSettingsRow,
  getPhaseById,
  getWorkoutLogsWithExerciseSince,
  resolveExerciseByName,
  getCmjTests,
  getSwimTimes,
  getJumpTests,
  getSorenessLogs,
  getSleepLogs,
  getTimeTo15mLogs,
  getBusinesses,
  getBusinessTransactions,
  resolveBusinessByName,
  resolveBusinessTaskByTitle,
  getAllMeetsWithEvents,
  getUndoneBusinessTasks,
  getWorkoutLogsSince,
  getSwimSessions,
} from "@/lib/db/queries";
import { computeProfit } from "@/lib/business/profit";
import { computeMeetReadiness } from "@/lib/swim/readiness";
import { estimateDistanceM } from "@/lib/swim/parseSets";
import { getCanvasSummary, getUrgentAssignments } from "@/lib/canvas/sync";
import { evaluateAlerts } from "@/lib/rules/engine";
import { computeKcalTarget, computeProteinTargetG, sevenDayAverage } from "@/lib/fuel/targets";
import { bestSetE1RM } from "@/lib/train/e1rm";
import { computeWeeklyTonnage } from "@/lib/analytics/tonnage";
import { buildAttentionItems } from "@/lib/dashboard/needsAttention";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "get_dashboard_summary",
      {
        description:
          "Countdown to NCAA/ASEAN, current training phase, latest bodyweight + trend, today's fuel targets vs logged, and active Coach alerts.",
        inputSchema: {},
      },
      async () => {
        const today = todayManilaISO();
        const [allPhases, latestWeighIn, weighInHistory, todaysFood, todaysWater, settingsRow, alerts] =
          await Promise.all([
            getAllPhasesWithSessions(),
            getLatestWeighIn(),
            getWeighIns(10),
            getFoodLogsForDate(today),
            getWaterLogsForDate(today),
            getSettingsRow(),
            evaluateAlerts(),
          ]);
        const currentPhase = getCurrentPhase(allPhases, today);
        const kcalTarget = computeKcalTarget(today);
        const avgWeight = sevenDayAverage(weighInHistory) ?? Number(latestWeighIn?.kg ?? 63);
        const proteinTarget = computeProteinTargetG(avgWeight);

        const summary = {
          today,
          daysToNcaa: Math.max(0, daysBetween(today, seasonData.meta.targets.ncaaDate)),
          aseanConfirmed: settingsRow.aseanConfirmed,
          currentPhase: currentPhase ? { id: currentPhase.id, tag: currentPhase.tag, name: currentPhase.name } : null,
          latestWeighInKg: latestWeighIn ? Number(latestWeighIn.kg) : null,
          weightTrendKg:
            weighInHistory.length >= 2 ? Number(weighInHistory[0].kg) - Number(weighInHistory[1].kg) : null,
          kcalTarget,
          proteinTargetG: proteinTarget,
          kcalLoggedToday: todaysFood.reduce((s, f) => s + f.kcal, 0),
          proteinLoggedToday: todaysFood.reduce((s, f) => s + Number(f.proteinG), 0),
          waterLoggedMl: todaysWater.reduce((s, w) => s + w.ml, 0),
          waterTargetMl: settingsRow.waterTargetMl,
          activeAlerts: alerts,
        };
        return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
      }
    );

    server.registerTool(
      "get_training_log",
      {
        description: "Logged workout sets in a date range (defaults to the last 7 days).",
        inputSchema: {
          from: z.string().optional().describe("YYYY-MM-DD, defaults to 7 days ago"),
          to: z.string().optional().describe("YYYY-MM-DD, defaults to today"),
        },
      },
      async ({ from }) => {
        const today = todayManilaISO();
        const since = from ?? addDaysISO(today, -7);
        const logs = await getWorkoutLogsWithExerciseSince(since);
        return { content: [{ type: "text" as const, text: JSON.stringify(logs, null, 2) }] };
      }
    );

    server.registerTool(
      "get_program",
      {
        description: "The periodized program: all 6 phases, or one phase's full session/exercise prescriptions.",
        inputSchema: { phase: z.string().optional().describe("Phase id, e.g. 'p3'. Omit for all phases.") },
      },
      async ({ phase }) => {
        if (phase) {
          const p = await getPhaseById(phase);
          if (!p) return { content: [{ type: "text" as const, text: `No phase with id "${phase}"` }], isError: true };
          return { content: [{ type: "text" as const, text: JSON.stringify(p, null, 2) }] };
        }
        const all = await getAllPhasesWithSessions();
        const summary = all.map((p) => ({ id: p.id, tag: p.tag, name: p.name, weeks: p.weeks, dates: p.dates, isDeload: p.isDeload }));
        return { content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }] };
      }
    );

    server.registerTool(
      "get_analytics",
      {
        description:
          "Analytics for one metric: e1rm, tonnage, cmj, bodyweight, swim, soreness, jump, sleep, or time_to_15m.",
        inputSchema: {
          metric: z.enum([
            "e1rm",
            "tonnage",
            "cmj",
            "bodyweight",
            "swim",
            "soreness",
            "jump",
            "sleep",
            "time_to_15m",
          ]),
          jump_type: z
            .enum(["broad_jump", "seated_box"])
            .optional()
            .describe("Only used when metric is 'jump'. Omit for both types."),
        },
      },
      async ({ metric, jump_type }) => {
        const today = todayManilaISO();
        if (metric === "e1rm") {
          const logs = await getWorkoutLogsWithExerciseSince(addDaysISO(today, -180));
          const byLift = new Map<string, { weightKg: number | null; reps: number | null }[]>();
          for (const l of logs) {
            if (!l.isMainLift) continue;
            if (!byLift.has(l.exerciseName)) byLift.set(l.exerciseName, []);
            byLift.get(l.exerciseName)!.push({ weightKg: l.weightKg ? Number(l.weightKg) : null, reps: l.reps });
          }
          const result = Object.fromEntries([...byLift.entries()].map(([name, sets]) => [name, bestSetE1RM(sets)]));
          return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
        }
        if (metric === "tonnage") {
          const logs = await getWorkoutLogsWithExerciseSince(addDaysISO(today, -90));
          return { content: [{ type: "text" as const, text: JSON.stringify(computeWeeklyTonnage(logs), null, 2) }] };
        }
        if (metric === "cmj") {
          const rows = await getCmjTests(12);
          return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
        }
        if (metric === "bodyweight") {
          const rows = await getWeighIns(60);
          return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
        }
        if (metric === "soreness") {
          const rows = await getSorenessLogs(30);
          return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
        }
        if (metric === "jump") {
          const rows = await getJumpTests(jump_type, 50);
          return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
        }
        if (metric === "sleep") {
          const rows = await getSleepLogs(30);
          return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
        }
        if (metric === "time_to_15m") {
          const rows = await getTimeTo15mLogs(50);
          return { content: [{ type: "text" as const, text: JSON.stringify(rows, null, 2) }] };
        }
        const rows = await getSwimTimes(50);
        return {
          content: [
            { type: "text" as const, text: JSON.stringify({ pbGoals: seasonData.PB_ROWS, targets: seasonData.TARGETS, logged: rows }, null, 2) },
          ],
        };
      }
    );

    server.registerTool(
      "log_food",
      {
        description: "Log a food entry. Claude should estimate macros in-chat, then call this with the estimate.",
        inputSchema: {
          date: z.string().optional().describe("YYYY-MM-DD, defaults to today"),
          time_slot: z.string().describe("One of: pre_race_pace, breakfast, lunch, pre_gym, dinner, bedtime, or a custom label"),
          description: z.string(),
          kcal: z.number(),
          protein_g: z.number(),
          carbs_g: z.number().optional(),
          fat_g: z.number().optional(),
        },
      },
      async ({ date, time_slot, description, kcal, protein_g, carbs_g, fat_g }) => {
        await db.insert(foodLogs).values({
          date: date ?? todayManilaISO(),
          timeSlot: time_slot,
          description,
          kcal: Math.round(kcal),
          proteinG: String(protein_g),
          carbsG: carbs_g !== undefined ? String(carbs_g) : null,
          fatG: fat_g !== undefined ? String(fat_g) : null,
          source: "ai",
        });
        return { content: [{ type: "text" as const, text: `Logged: ${description} (${kcal} kcal, ${protein_g}g protein).` }] };
      }
    );

    server.registerTool(
      "log_meal",
      {
        description: "Log a full meal in one call -- multiple foods at once (e.g. describing a whole day's eating). Claude should estimate macros per food, then call this once with the list.",
        inputSchema: {
          date: z.string().optional().describe("YYYY-MM-DD, defaults to today"),
          time_slot: z.string().describe("One of: pre_race_pace, breakfast, lunch, pre_gym, dinner, bedtime, snack, or a custom label"),
          foods: z
            .array(
              z.object({
                description: z.string(),
                kcal: z.number(),
                protein_g: z.number(),
                carbs_g: z.number().optional(),
                fat_g: z.number().optional(),
              })
            )
            .min(1),
        },
      },
      async ({ date, time_slot, foods }) => {
        const d = date ?? todayManilaISO();
        await db.insert(foodLogs).values(
          foods.map((f) => ({
            date: d,
            timeSlot: time_slot,
            description: f.description,
            kcal: Math.round(f.kcal),
            proteinG: String(f.protein_g),
            carbsG: f.carbs_g !== undefined ? String(f.carbs_g) : null,
            fatG: f.fat_g !== undefined ? String(f.fat_g) : null,
            source: "ai" as const,
          }))
        );
        const totalKcal = foods.reduce((s, f) => s + f.kcal, 0);
        return { content: [{ type: "text" as const, text: `Logged ${foods.length} food${foods.length === 1 ? "" : "s"} for ${time_slot} (${totalKcal} kcal total).` }] };
      }
    );

    server.registerTool(
      "log_water",
      { description: "Log water intake in milliliters.", inputSchema: { ml: z.number(), date: z.string().optional() } },
      async ({ ml, date }) => {
        await db.insert(waterLogs).values({ date: date ?? todayManilaISO(), ml });
        return { content: [{ type: "text" as const, text: `Logged ${ml}ml of water.` }] };
      }
    );

    server.registerTool(
      "log_weigh_in",
      { description: "Log a bodyweight measurement in kg.", inputSchema: { kg: z.number(), date: z.string().optional() } },
      async ({ kg, date }) => {
        const d = date ?? todayManilaISO();
        await db.insert(weighIns).values({ date: d, kg: String(kg) }).onConflictDoUpdate({ target: weighIns.date, set: { kg: String(kg) } });
        return { content: [{ type: "text" as const, text: `Logged weigh-in: ${kg}kg on ${d}.` }] };
      }
    );

    server.registerTool(
      "log_sleep",
      {
        description: "Log last night's sleep.",
        inputSchema: { hours: z.number(), bedtime: z.string().optional().describe("HH:MM, 24h") },
      },
      async ({ hours, bedtime }) => {
        const today = todayManilaISO();
        const dayKey = new Date(`${today}T12:00:00Z`).getUTCDay();
        const isBedtimeCheckDay = dayKey === 2 || dayKey === 4; // Tue/Thu
        const onTime = isBedtimeCheckDay && bedtime ? bedtime <= "21:30" : null;
        await db.insert(sleepLogs).values({ date: today, hours: String(hours), bedtime: bedtime ?? null, onTime });
        return { content: [{ type: "text" as const, text: `Logged ${hours}h of sleep.` }] };
      }
    );

    server.registerTool(
      "log_workout_set",
      {
        description: "Log one logged set for an exercise, matched by name against today's/current-phase prescriptions.",
        inputSchema: {
          exercise: z.string().describe("Exercise name, e.g. 'Back squat'"),
          weight_kg: z.number().optional(),
          reps: z.number().optional(),
          rpe: z.number().optional(),
        },
      },
      async ({ exercise, weight_kg, reps, rpe }) => {
        const match = await resolveExerciseByName(exercise);
        if (!match) {
          return { content: [{ type: "text" as const, text: `No exercise found matching "${exercise}".` }], isError: true };
        }
        const today = todayManilaISO();
        const existing = await db
          .select()
          .from(workoutLogs)
          .where(and(eq(workoutLogs.exerciseId, match.id), eq(workoutLogs.date, today)));
        const setNumber = existing.length + 1;
        await db.insert(workoutLogs).values({
          date: today,
          exerciseId: match.id,
          setNumber,
          weightKg: weight_kg !== undefined ? String(weight_kg) : null,
          reps: reps ?? null,
          rpe: rpe !== undefined ? String(rpe) : null,
        });
        return {
          content: [
            { type: "text" as const, text: `Logged set ${setNumber} of ${match.name}: ${weight_kg ?? "–"}kg x ${reps ?? "–"} @ RPE ${rpe ?? "–"}.` },
          ],
        };
      }
    );

    server.registerTool(
      "log_swim_time",
      {
        description: "Log a swim time for a race event.",
        inputSchema: {
          event: z.string().describe("e.g. '200 Breast', '200 IM'"),
          time_ms: z.number().describe("Total time in milliseconds"),
          meet_name: z.string().optional(),
          splits: z.array(z.number()).optional().describe("50m split times in seconds"),
          stroke_counts: z.array(z.number()).optional(),
        },
      },
      async ({ event, time_ms, meet_name, splits, stroke_counts }) => {
        await db.insert(swimTimes).values({
          date: todayManilaISO(),
          event,
          timeMs: time_ms,
          meetName: meet_name ?? null,
          splits: splits ?? null,
          strokeCounts: stroke_counts ?? null,
        });
        return { content: [{ type: "text" as const, text: `Logged ${event}: ${(time_ms / 1000).toFixed(2)}s.` }] };
      }
    );

    server.registerTool(
      "log_cmj",
      { description: "Log a countermovement jump test (best of 3), the weekly Sunday fatigue monitor.", inputSchema: { cm: z.number() } },
      async ({ cm }) => {
        await db.insert(cmjTests).values({ date: todayManilaISO(), bestOf3Cm: String(cm) });
        return { content: [{ type: "text" as const, text: `Logged CMJ: ${cm}cm.` }] };
      }
    );

    server.registerTool(
      "log_soreness",
      {
        description: "Log a muscle soreness rating for a body area.",
        inputSchema: {
          rating: z.number().min(1).max(5).describe("1 (none) to 5 (severe)"),
          area: z.string().describe("e.g. 'shins', 'shoulders', 'quads'"),
          date: z.string().optional(),
        },
      },
      async ({ rating, area, date }) => {
        await db.insert(sorenessLogs).values({ date: date ?? todayManilaISO(), rating1to5: rating, area });
        return { content: [{ type: "text" as const, text: `Logged soreness: ${area} at ${rating}/5.` }] };
      }
    );

    server.registerTool(
      "log_jump_test",
      {
        description: "Log a broad jump or seated box jump test result.",
        inputSchema: {
          type: z.enum(["broad_jump", "seated_box"]),
          cm: z.number(),
          date: z.string().optional(),
        },
      },
      async ({ type, cm, date }) => {
        await db.insert(jumpTests).values({ date: date ?? todayManilaISO(), type, valueCm: String(cm) });
        return { content: [{ type: "text" as const, text: `Logged ${type.replace("_", " ")}: ${cm}cm.` }] };
      }
    );

    server.registerTool(
      "log_time_to_15m",
      {
        description: "Log a 15m sprint acceleration time, fresh or fatigued.",
        inputSchema: {
          seconds: z.number(),
          condition: z.enum(["fresh", "fatigued"]),
          date: z.string().optional(),
        },
      },
      async ({ seconds, condition, date }) => {
        await db.insert(timeTo15m).values({ date: date ?? todayManilaISO(), seconds: String(seconds), condition });
        return { content: [{ type: "text" as const, text: `Logged 15m time: ${seconds}s (${condition}).` }] };
      }
    );

    server.registerTool(
      "update_settings",
      {
        description:
          "Update app settings: ASEAN confirmation status, daily water target, or preferred weight unit. Only the fields provided are changed.",
        inputSchema: {
          asean_confirmed: z.boolean().nullable().optional().describe("true=confirmed, false=cancelled, null=unknown"),
          water_target_ml: z.number().optional(),
          weight_unit: z.enum(["kg", "lb"]).optional(),
        },
      },
      async ({ asean_confirmed, water_target_ml, weight_unit }) => {
        const current = await getSettingsRow();
        await db
          .update(settings)
          .set({
            aseanConfirmed: asean_confirmed !== undefined ? asean_confirmed : current.aseanConfirmed,
            waterTargetMl: water_target_ml ?? current.waterTargetMl,
            weightUnit: weight_unit ?? current.weightUnit,
          })
          .where(eq(settings.id, "singleton"));
        return { content: [{ type: "text" as const, text: "Settings updated." }] };
      }
    );

    server.registerTool(
      "get_businesses",
      {
        description: "List all business ventures with income/expense totals and profit.",
        inputSchema: {},
      },
      async () => {
        const allBusinesses = await getBusinesses();
        const summaries = await Promise.all(
          allBusinesses.map(async (b) => {
            const transactions = await getBusinessTransactions(b.id, 1000);
            const profit = computeProfit(transactions);
            return { id: b.id, name: b.name, archived: b.archived, ...profit };
          })
        );
        return { content: [{ type: "text" as const, text: JSON.stringify(summaries, null, 2) }] };
      }
    );

    server.registerTool(
      "log_business_transaction",
      {
        description: "Log an income or expense entry (in PHP) for a business venture, matched by name.",
        inputSchema: {
          business: z.string().describe("Venture name, e.g. 'Print shop'"),
          type: z.enum(["income", "expense"]),
          amount_php: z.number(),
          description: z.string(),
          date: z.string().optional(),
        },
      },
      async ({ business, type, amount_php, description, date }) => {
        const match = await resolveBusinessByName(business);
        if (!match) {
          return { content: [{ type: "text" as const, text: `No business found matching "${business}".` }], isError: true };
        }
        await db.insert(businessTransactions).values({
          businessId: match.id,
          type,
          amountPhp: String(amount_php),
          description,
          date: date ?? todayManilaISO(),
        });
        return { content: [{ type: "text" as const, text: `Logged ${type} of ₱${amount_php} for ${match.name}: ${description}.` }] };
      }
    );

    server.registerTool(
      "add_business_task",
      {
        description: "Add a to-do task to a business venture, matched by name.",
        inputSchema: {
          business: z.string().describe("Venture name"),
          title: z.string(),
          due_date: z.string().optional().describe("YYYY-MM-DD"),
        },
      },
      async ({ business, title, due_date }) => {
        const match = await resolveBusinessByName(business);
        if (!match) {
          return { content: [{ type: "text" as const, text: `No business found matching "${business}".` }], isError: true };
        }
        await db.insert(businessTasks).values({ businessId: match.id, title, dueDate: due_date ?? null });
        return { content: [{ type: "text" as const, text: `Added task "${title}" to ${match.name}.` }] };
      }
    );

    server.registerTool(
      "complete_business_task",
      {
        description: "Mark a business task done, matched by venture name and task title.",
        inputSchema: {
          business: z.string().describe("Venture name"),
          task: z.string().describe("Task title (or substring)"),
        },
      },
      async ({ business, task }) => {
        const businessMatch = await resolveBusinessByName(business);
        if (!businessMatch) {
          return { content: [{ type: "text" as const, text: `No business found matching "${business}".` }], isError: true };
        }
        const taskMatch = await resolveBusinessTaskByTitle(businessMatch.id, task);
        if (!taskMatch) {
          return { content: [{ type: "text" as const, text: `No task found matching "${task}" for ${businessMatch.name}.` }], isError: true };
        }
        await db.update(businessTasks).set({ done: true }).where(eq(businessTasks.id, taskMatch.id));
        return { content: [{ type: "text" as const, text: `Marked "${taskMatch.title}" done for ${businessMatch.name}.` }] };
      }
    );

    server.registerTool(
      "get_school_summary",
      {
        description:
          "Canvas LMS summary: active courses with current grades, and assignments with due dates/submission status. Returns configured=false if Canvas isn't set up yet.",
        inputSchema: { urgent_only: z.boolean().optional().describe("If true, only overdue/due-within-3-days unsubmitted assignments.") },
      },
      async ({ urgent_only }) => {
        const summary = await getCanvasSummary();
        const assignments = urgent_only ? getUrgentAssignments(summary.assignments) : summary.assignments;
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ ...summary, assignments }, null, 2),
            },
          ],
        };
      }
    );

    server.registerTool(
      "log_swim_session",
      {
        description: "Log a swim training session: subjective load (1-10) and optional free-text sets. Distinct from log_swim_time (race/time-trial results).",
        inputSchema: {
          load_rating: z.number().min(1).max(10),
          sets_text: z.string().optional().describe("e.g. '10x100 BR @1:30, main set 6x200 IM'"),
          date: z.string().optional(),
        },
      },
      async ({ load_rating, sets_text, date }) => {
        await db.insert(swimSessions).values({
          date: date ?? todayManilaISO(),
          loadRating: load_rating,
          setsText: sets_text ?? null,
          parsedDistanceM: sets_text ? estimateDistanceM(sets_text) : null,
        });
        return { content: [{ type: "text" as const, text: `Logged swim session: load ${load_rating}/10${sets_text ? `, ${sets_text}` : ""}.` }] };
      }
    );

    server.registerTool(
      "get_meet_readiness",
      {
        description: "Per-event readiness for upcoming meets: current best, projected time at the meet date (trend-fit from logged swim times), gap to target, and confidence.",
        inputSchema: {
          meet: z.string().optional().describe("Meet name (or substring). Omit for all meets."),
        },
      },
      async ({ meet }) => {
        const allMeets = await getAllMeetsWithEvents();
        const filtered = meet ? allMeets.filter((m) => m.name.toLowerCase().includes(meet.toLowerCase())) : allMeets;
        if (meet && filtered.length === 0) {
          return { content: [{ type: "text" as const, text: `No meet found matching "${meet}".` }], isError: true };
        }
        const today = todayManilaISO();
        const allSwimTimes = await getSwimTimes(200);
        const result = filtered.map((m) => ({
          meet: m.name,
          date: m.date,
          events: m.events.map((ev) => {
            const loggedTimes = allSwimTimes.filter((s) => s.event === ev.event).map((s) => ({ date: s.date, timeMs: s.timeMs }));
            return {
              event: ev.event,
              targetTimeMs: ev.targetTimeMs,
              ...computeMeetReadiness({ targetTimeMs: ev.targetTimeMs, loggedTimes, meetDate: m.date, today }),
            };
          }),
        }));
        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      }
    );

    server.registerTool(
      "log_gym_session",
      {
        description: "Log a full gym session in one call -- every set across every exercise (e.g. describing a whole workout: 'squats 3x5 at 80kg, bench 3x8 at 60kg'). Each exercise is matched by name against today's/current-phase prescriptions, same as log_workout_set.",
        inputSchema: {
          sets: z
            .array(
              z.object({
                exercise: z.string().describe("Exercise name, e.g. 'Back squat'"),
                weight_kg: z.number().optional(),
                reps: z.number().optional(),
                rpe: z.number().optional(),
              })
            )
            .min(1),
        },
      },
      async ({ sets }) => {
        const today = todayManilaISO();
        const logged: string[] = [];
        const notFound: string[] = [];
        const setNumberByExerciseId = new Map<number, number>();

        for (const s of sets) {
          const match = await resolveExerciseByName(s.exercise);
          if (!match) {
            notFound.push(s.exercise);
            continue;
          }
          if (!setNumberByExerciseId.has(match.id)) {
            const existing = await db
              .select()
              .from(workoutLogs)
              .where(and(eq(workoutLogs.exerciseId, match.id), eq(workoutLogs.date, today)));
            setNumberByExerciseId.set(match.id, existing.length);
          }
          const setNumber = setNumberByExerciseId.get(match.id)! + 1;
          setNumberByExerciseId.set(match.id, setNumber);
          await db.insert(workoutLogs).values({
            date: today,
            exerciseId: match.id,
            setNumber,
            weightKg: s.weight_kg !== undefined ? String(s.weight_kg) : null,
            reps: s.reps ?? null,
            rpe: s.rpe !== undefined ? String(s.rpe) : null,
          });
          logged.push(`${match.name} set ${setNumber}: ${s.weight_kg ?? "–"}kg x ${s.reps ?? "–"} @ RPE ${s.rpe ?? "–"}`);
        }

        const summary = `Logged ${logged.length} set${logged.length === 1 ? "" : "s"}.${notFound.length > 0 ? ` No exercise found matching: ${notFound.join(", ")}.` : ""}`;
        return {
          content: [{ type: "text" as const, text: `${summary}\n${logged.join("\n")}` }],
          isError: notFound.length > 0 && logged.length === 0,
        };
      }
    );

    server.registerTool(
      "get_pending_items",
      {
        description: "Everything needing attention right now across every module: unlogged training/swim/fuel/recovery for today, undone business tasks, and upcoming school assignments. The daily digest -- ask this any time to know what to log or do.",
        inputSchema: {},
      },
      async () => {
        const today = todayManilaISO();
        const todayKey = todayDayKey();
        const hour = manilaHourNow();
        const dayIndex: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

        const [allPhases, todaysFood, undoneTasks, canvas, recentWorkoutLogs, recentSwimSessions, recentSleepLogs] = await Promise.all([
          getAllPhasesWithSessions(),
          getFoodLogsForDate(today),
          getUndoneBusinessTasks(10),
          getCanvasSummary(),
          getWorkoutLogsSince(addDaysISO(today, -400)),
          getSwimSessions(5),
          getSleepLogs(1),
        ]);

        const currentPhase = getCurrentPhase(allPhases, today) ?? allPhases[0];
        const todaySession = currentPhase.sessions.find((s) => s.dayKey === todayKey) ?? null;
        const weekDay = seasonData.WEEK[dayIndex[todayKey]];

        const items = buildAttentionItems({
          today,
          todayKey,
          hour,
          currentPhaseId: currentPhase.id,
          todaySession: todaySession ? { title: todaySession.title } : null,
          weekDay,
          loggedWorkoutToday: recentWorkoutLogs.some((l) => l.date === today),
          loggedSwimSessionToday: recentSwimSessions.some((s) => s.date === today),
          foodLoggedTodayCount: todaysFood.length,
          sleepLoggedToday: recentSleepLogs.some((s) => s.date === today),
          undoneBusinessTasks: undoneTasks,
          urgentSchoolAssignments: getUrgentAssignments(canvas.assignments),
        });

        return { content: [{ type: "text" as const, text: JSON.stringify(items, null, 2) }] };
      }
    );
  },
  { serverInfo: { name: "road-to-december", version: "1.0.0" } },
  { verboseLogs: false, streamableHttpEndpoint: "/api/mcp", disableSse: true }
);

function verifyToken(_req: Request, bearerToken?: string) {
  const expected = process.env.MCP_BEARER_TOKEN;
  if (!expected || !bearerToken) return undefined;

  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(bearerToken);
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return undefined;
  }

  return { token: bearerToken, clientId: "road-to-december-owner", scopes: ["*"] };
}

const authedHandler = withMcpAuth(handler, verifyToken, { required: true });

export { authedHandler as GET, authedHandler as POST, authedHandler as DELETE };
