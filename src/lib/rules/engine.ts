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
export async function evaluateAlerts(): Promise<RuleAlert[]> {
  const alerts: RuleAlert[] = [];
  const today = todayManilaISO();
  const todayKey = todayDayKey();

  const allPhases = await getAllPhasesWithSessions();
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
  const cmjRows = await getCmjTests(12);
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
    const recentWeighIns = await getWeighIns(21);
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
  const settingsRow = await getSettingsRow();
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
      const recentLogs = await getWorkoutLogsSince(today);
      const hasHeavyBarbell = recentLogs.some(
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
  const hour = manilaHourNow();
  if (hour >= 16) {
    const todaysFood = await getFoodLogsForDate(today);
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

  return alerts;
}
