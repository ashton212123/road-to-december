/**
 * Carb periodization by day demand (loop 38): replaces the flat 25%-of-kcal
 * fat split, which left carbs at ~8.2 g/kg on a full-rest Monday and on a
 * double-session Saturday alike. Targets from E9 (5-12 g/kg; 8-10 g/kg for
 * >12h/wk moderate-to-high training).
 */

import type { EnergyTarget } from "./energyModel";
import type { SessionType } from "@/lib/swim/sessionType";

export type DayDemand = "rest" | "moderate" | "high" | "very-high";

export type DayFuelPlan = {
  dateISO: string;
  dayDemand: DayDemand;
  carbsG: number;
  carbGPerKg: number;
  proteinG: number;
  fatG: number;
  kcal: number;
  why: string;
  timing: { when: string; what: string; why: string }[];
};

const CARB_G_PER_KG: Record<DayDemand, number> = { rest: 5, moderate: 7, high: 9, "very-high": 10 };
const DEMAND_LABEL: Record<DayDemand, string> = { rest: "Rest", moderate: "Moderate", high: "High", "very-high": "Very high" };
const PROTEIN_G_PER_KG_FLOOR = 1.8; // E10
const PROTEIN_G_PER_KG_GAIN = 2.0; // top of the 1.2-2.1 consensus band, E10
const FAT_G_PER_KG_FLOOR = 0.8; // hormonal-health floor -- this is what lets carbs move day to day instead of fat absorbing the swing

function classifyDayDemand(params: { scheduledSwims: number; scheduledGym: boolean; plannedSessionType: SessionType | null }): DayDemand {
  const { scheduledSwims, scheduledGym, plannedSessionType } = params;
  if (scheduledSwims === 0 && !scheduledGym) return "rest";
  if (scheduledSwims >= 2) return "very-high"; // double session, e.g. Saturday
  if (plannedSessionType === "race_pace") return "very-high"; // 5 AM race-pace day, e.g. Wed/Fri
  if (scheduledSwims >= 1 && scheduledGym) return "high"; // swim + heavy lift, e.g. Tue/Thu/Sun
  return "moderate"; // single swim, or swim + light lift, or gym only
}

function buildTiming(params: { scheduledSwims: number; scheduledGym: boolean; plannedSessionType: SessionType | null }): DayFuelPlan["timing"] {
  const { scheduledSwims, scheduledGym, plannedSessionType } = params;
  const timing: DayFuelPlan["timing"] = [];
  const totalSessions = scheduledSwims + (scheduledGym ? 1 : 0);

  if (plannedSessionType === "race_pace") {
    timing.push({
      when: "Pre-session, ~30-45 min before",
      what: "30-60g easy carbs",
      why: "Overnight liver glycogen is low; race-pace work without it means rehearsing race velocity on a fuel state you'll never race in [moderate].",
    });
  }

  if (totalSessions >= 2) {
    timing.push({
      when: "Within ~60 min after the first session",
      what: "~1 g/kg carbs + ~0.3 g/kg protein",
      why: "Only matters when the next session is <8h away -- on a single-session day, total daily intake is what counts, not the window [moderate].",
    });
  }

  if (scheduledSwims >= 2) {
    timing.push({
      when: "The 30-60 min window between the two swims",
      what: "Carbs + fluid",
      why: "This is the only real refuelling gap in a double-swim day.",
    });
  }

  return timing;
}

export function buildDayFuelPlan(params: {
  dateISO: string;
  bodyweightKg: number;
  energyTarget: EnergyTarget;
  scheduledSwims: number;
  scheduledGym: boolean;
  plannedSessionType: SessionType | null;
}): DayFuelPlan {
  const { dateISO, bodyweightKg, energyTarget, scheduledSwims, scheduledGym, plannedSessionType } = params;

  const dayDemand = classifyDayDemand({ scheduledSwims, scheduledGym, plannedSessionType });
  const carbGPerKg = CARB_G_PER_KG[dayDemand];
  const carbsG = Math.round(carbGPerKg * bodyweightKg);

  const proteinGPerKg = energyTarget.phase === "gain" ? PROTEIN_G_PER_KG_GAIN : PROTEIN_G_PER_KG_FLOOR;
  const proteinG = Math.round(proteinGPerKg * bodyweightKg);

  const carbsKcal = carbsG * 4;
  const proteinKcal = proteinG * 4;
  const fatFloorG = Math.round(FAT_G_PER_KG_FLOOR * bodyweightKg);
  const fatFromRemainingKcal = Math.round((energyTarget.kcal - carbsKcal - proteinKcal) / 9);
  const fatG = Math.max(fatFloorG, fatFromRemainingKcal);

  // Always recomputed from the actual grams below, not energyTarget.kcal
  // directly, so kcal and C/P/F never silently disagree with each other.
  const kcal = carbsG * 4 + proteinG * 4 + fatG * 9;

  const why = `${DEMAND_LABEL[dayDemand]} demand day → ${carbGPerKg}g/kg carbs [moderate, E9]. Protein ${proteinGPerKg}g/kg, fat floored at ${FAT_G_PER_KG_FLOOR}g/kg for hormonal health -- carbs are what actually moves with training demand.`;

  return {
    dateISO,
    dayDemand,
    carbsG,
    carbGPerKg,
    proteinG,
    fatG,
    kcal,
    why,
    timing: buildTiming({ scheduledSwims, scheduledGym, plannedSessionType }),
  };
}
