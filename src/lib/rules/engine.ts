import type { AlertTone } from "@/components/ui/AlertCard";
import { todayManilaISO, todayDayKey, manilaHourNow, daysBetween } from "../time";
import {
  getAllPhasesWithSessions,
  getCurrentPhase,
  getCmjTests,
  getWeighIns,
  getFoodLogsForDate,
  getSettingsRow,
  getWorkoutLogsSince,
} from "../db/queries";
import { seasonData } from "../data/season-data";
import { getCanvasSummary, getCriticalAssignments, type CanvasSummary } from "../canvas/sync";

export type RuleAlert = {
  id: string;
  tone: AlertTone;
  title: string;
  body: string;
};

const DOUBLE_SWIM_DAYS = new Set(["wed", "thu", "sat"]);

function weekdayGroups<T extends { date: string }>(rows: T[]) {
  // Groups already-sorted-desc rows into consecutive ISO weeks (Mon-start).
  const byWeek = new Map<string, T[]>();
  for (const row of rows) {
    const d = new Date(`${row.date}T12:00:00Z`);
    const day = (d.getUTCDay() + 6) % 7; // Mon=0
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - day);
    const key = monday.toISOString().slice(0, 10);
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key)!.push(row);
  }
  return [...byWeek.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)); // newest week first
}

/**
 * Evaluates the program's coaching rules into dismissible alert cards.
 * Pure-ish: takes the current date implicitly (Asia/Manila) and reads from
 * the database; every rule maps 1:1 to a bullet in /data/program.md's
 * "Coaching Rules Summary" section.
 */
/** `canvasSummary`: pass a pre-fetched summary to avoid a duplicate fetch/sync
 * when the caller already has one (e.g. Home renders this alongside its own
 * Canvas read) -- omit to fetch internally (e.g. the MCP get_dashboard_summary
 * tool, which has nothing else to share it with).
 * `prefetched`: same idea for the rest -- Home already fetches equivalent-or-
 * wider data with its own Promise.all, so re-fetching here was redundant
 * round-trips per page load on an already-strained DB (see DECISIONS.md,
 * connection-pressure investigation). `weighIns21` must be the last 21 rows
 * (same order/shape as `getWeighIns(21)`); `workoutLogsWide` must cover at
 * least today (e.g. Home's -150-day window) -- filtered locally for today's
 * rows instead of a fresh `getWorkoutLogsSince(today)` query. Omit any of
 * these to fetch internally. */
export async function evaluateAlerts(
  canvasSummary?: CanvasSummary,
  prefetched?: {
    settingsRow?: Awaited<ReturnType<typeof getSettingsRow>>;
    todaysFood?: Awaited<ReturnType<typeof getFoodLogsForDate>>;
    weighIns21?: Awaited<ReturnType<typeof getWeighIns>>;
    workoutLogsWide?: Awaited<ReturnType<typeof getWorkoutLogsSince>>;
  }
): Promise<RuleAlert[]> {
  const alerts: RuleAlert[] = [];
  const today = todayManilaISO();
  const todayKey = todayDayKey();
  const hour = manilaHourNow();

  // Every query this function needs, fetched in parallel instead of one
  // sequential chain of ~8 round-trips (the original structure serialized
  // independent queries -- allPhases, cmjRows, weighIns, settings, workout
  // logs, food logs, and Canvas all one-after-another -- which was the real
  // cause of Home feeling slow to load, not any single query being heavy).
  const [allPhases, cmjRows, recentWeighIns, settingsRow, workoutLogsWide, todaysFood, canvas] = await Promise.all([
    getAllPhasesWithSessions(),
    getCmjTests(12),
    prefetched?.weighIns21 ? Promise.resolve(prefetched.weighIns21) : getWeighIns(21),
    prefetched?.settingsRow ? Promise.resolve(prefetched.settingsRow) : getSettingsRow(),
    prefetched?.workoutLogsWide ? Promise.resolve(prefetched.workoutLogsWide) : getWorkoutLogsSince(today),
    prefetched?.todaysFood ? Promise.resolve(prefetched.todaysFood) : getFoodLogsForDate(today),
    canvasSummary ? Promise.resolve(canvasSummary) : getCanvasSummary(),
  ]);
  const workoutLogsToday = workoutLogsWide.filter((l) => l.date === today);
  const currentPhase = getCurrentPhase(allPhases, today);

  // Rule 1: double-swim day RPE drop.
  if (DOUBLE_SWIM_DAYS.has(todayKey)) {
    alerts.push({
      id: "double-swim-rpe",
      tone: "warning",
      title: "Double-swim day",
      body: "Drop every gym RPE target by 1 today.",
    });
  }

  // Rule 2: P3+ bar-speed reminder.
  if (currentPhase && ["p3", "p4", "p5"].includes(currentPhase.id)) {
    alerts.push({
      id: "bar-speed",
      tone: "info",
      title: "Bar-speed rule",
      body: "A grinding rep ends the set.",
    });
  }

  // Rule 3: CMJ down 2 consecutive weeks.
  const cmjWeeks = weekdayGroups(cmjRows).map(([, rows]) => {
    const best = Math.max(...rows.map((r) => Number(r.bestOf3Cm)));
    return best;
  });
  if (cmjWeeks.length >= 3 && cmjWeeks[0] < cmjWeeks[1] && cmjWeeks[1] < cmjWeeks[2]) {
    alerts.push({
      id: "cmj-decline",
      tone: "danger",
      title: "CMJ down 2 weeks running",
      body: "Cut this week's gym volume 30% before it costs you in the pool.",
    });
  }

  // Rule 4: bodyweight flat 2 weeks during P2 (bulk window).
  if (currentPhase?.id === "p2") {
    const weeks = weekdayGroups(recentWeighIns).slice(0, 2);
    if (weeks.length === 2) {
      const [thisWeek, lastWeek] = weeks;
      const avg = (rows: typeof recentWeighIns) =>
        rows.reduce((sum, r) => sum + Number(r.kg), 0) / rows.length;
      const delta = avg(thisWeek[1]) - avg(lastWeek[1]);
      if (Math.abs(delta) < 0.15) {
        alerts.push({
          id: "weight-flat",
          tone: "warning",
          title: "Bodyweight flat 2 weeks",
          body: "Add ~300 kcal/day. The gain window closes Aug 30.",
        });
      }
    }
  }

  // Rule 5: ASEAN status still unknown, reminder to confirm as the date nears.
  if (settingsRow.aseanConfirmed === null) {
    const daysToAsean = daysBetween(today, seasonData.meta.targets.aseanDate);
    if (daysToAsean <= 42 && daysToAsean >= 0) {
      alerts.push({
        id: "asean-unknown",
        tone: "info",
        title: "ASEAN status still unknown",
        body: "Confirm or cancel in Settings the moment you know — the taper math locks that day.",
      });
    }
  }

  // Rule 6: calendar locks near meets — warn if a heavy barbell or plyo
  // session was logged inside the lockout window before a target meet.
  const meetDates = [seasonData.meta.targets.ncaaDate];
  if (settingsRow.aseanConfirmed) meetDates.push(seasonData.meta.targets.aseanDate);
  for (const meetDate of meetDates) {
    const daysToMeet = daysBetween(today, meetDate);
    if (daysToMeet >= 0 && daysToMeet <= 10) {
      const hasHeavyBarbell = workoutLogsToday.some(
        (l) => l.date === today && Number(l.weightKg ?? 0) > 0 && daysToMeet < 8
      );
      if (hasHeavyBarbell) {
        alerts.push({
          id: `calendar-lock-${meetDate}`,
          tone: "danger",
          title: "Calendar lock violated",
          body: `Last heavy barbell work should be 8–10 days out. ${daysToMeet} days remain until the meet.`,
        });
      }
      if (daysToMeet < 5) {
        alerts.push({
          id: `taper-plyo-${meetDate}`,
          tone: "warning",
          title: "Inside the plyo lockout",
          body: "Last plyometric work should be 5 days out — keep today's session light and nothing new.",
        });
      }
    }
  }

  // Rule 7: missed lunch by 4 PM.
  if (hour >= 16) {
    const loggedLunch = todaysFood.some((f) => f.timeSlot === "lunch" || f.description.toLowerCase().includes("lunch"));
    if (!loggedLunch) {
      alerts.push({
        id: "missed-lunch",
        tone: "warning",
        title: "No lunch logged yet",
        body: "Skipping lunch is how June happened — log it or eat something now.",
      });
    }
  }

  // Rule 8: Canvas assignments due within 48h -- sync + alert only, never
  // auto-completed or auto-submitted. A distinct, more severe tier than the
  // general due-soon list on Home.
  if (canvas.configured && !canvas.error) {
    for (const a of getCriticalAssignments(canvas.assignments)) {
      const overdue = a.dueAt !== null && a.dueAt.getTime() < Date.now();
      alerts.push({
        id: `canvas-critical-${a.id}`,
        tone: "danger",
        title: overdue ? "Canvas assignment overdue" : "Canvas assignment due within 48h",
        body: `${a.name} (${a.courseName})`,
      });
    }
  }

  return alerts;
}
