"use server";

import { revalidatePath, updateTag } from "next/cache";
import { eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { foodLogs, waterLogs, weighIns } from "@/lib/db/schema";
import { todayManilaISO, manilaHourNow, addDaysISO, dayKeyForDate } from "@/lib/time";
import { parseMealText, defaultTimeSlotForHour } from "@/lib/nutrition/parseMealText";
import { searchFood, type FoodCandidate } from "@/lib/nutrition/usda";
import { estimateMacros, rethinkMacroItem, type AiMacroItem, type MacroBudgetContext } from "@/lib/nutrition/aiMacros";
import { computeProteinTargetG, sevenDayAverage } from "@/lib/fuel/targets";
import { computeEnergyTarget, computeAutoEnergyPhase } from "@/lib/fuel/energyModel";
import { buildDayFuelPlan } from "@/lib/fuel/carbPeriodization";
import { deriveDaySchedule } from "@/lib/fuel/scheduleFromWeek";
import { seasonData } from "@/lib/data/season-data";
import { getSettingsRow, getAllMeetsWithEvents } from "@/lib/db/queries";

const DAY_KEY_TO_WEEK_INDEX: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

/** Self-contained: fetches its own weight/food/settings context rather than
 * trusting client-passed values, same pattern as the swim session actions. */
async function buildMacroBudgetContext(): Promise<MacroBudgetContext> {
  const today = todayManilaISO();
  const [weighInHistory, recentFoodLogs, settingsRow, todaysFood, allMeets] = await Promise.all([
    db.select().from(weighIns).where(gte(weighIns.date, addDaysISO(today, -29))),
    db.select().from(foodLogs).where(gte(foodLogs.date, addDaysISO(today, -13))),
    getSettingsRow(),
    db.select().from(foodLogs).where(eq(foodLogs.date, today)),
    getAllMeetsWithEvents(),
  ]);

  const weighInsNum = weighInHistory.map((w) => ({ date: w.date, kg: Number(w.kg) }));
  const avgWeightKg = sevenDayAverage(weighInHistory.map((w) => ({ date: w.date, kg: w.kg }))) ?? 63;
  const nextMeetDate = allMeets.filter((m) => m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0]?.date ?? null;
  const energyPhase =
    settingsRow.energyPhase ??
    computeAutoEnergyPhase({ todayISO: today, bulkWindowEndISO: seasonData.meta.bulkWindowEnd, firstMeetDateISO: nextMeetDate });
  const kcalByDate = new Map<string, number>();
  for (const f of recentFoodLogs) kcalByDate.set(f.date, (kcalByDate.get(f.date) ?? 0) + f.kcal);
  const energyTarget = computeEnergyTarget({
    todayISO: today,
    energyPhase,
    kcalTargetOverride: settingsRow.kcalTargetOverride,
    weighIns: weighInsNum,
    recentKcal: [...kcalByDate.entries()].map(([date, kcal]) => ({ date, kcal })),
  });
  const proteinTarget = computeProteinTargetG(avgWeightKg);
  const schedule = deriveDaySchedule(seasonData.WEEK[DAY_KEY_TO_WEEK_INDEX[dayKeyForDate(today)]]);
  const dayPlan = buildDayFuelPlan({ dateISO: today, bodyweightKg: avgWeightKg, energyTarget, ...schedule });

  const kcalLogged = todaysFood.reduce((s, f) => s + f.kcal, 0);
  const proteinLogged = todaysFood.reduce((s, f) => s + Number(f.proteinG), 0);
  const carbsLogged = todaysFood.reduce((s, f) => s + Number(f.carbsG ?? 0), 0);
  const fatLogged = todaysFood.reduce((s, f) => s + Number(f.fatG ?? 0), 0);

  return {
    avgWeightKg,
    remainingKcal: Math.max(0, energyTarget.kcal - kcalLogged),
    remainingProteinG: Math.max(0, proteinTarget.mid - proteinLogged),
    remainingCarbsG: Math.max(0, dayPlan.carbsG - carbsLogged),
    remainingFatG: Math.max(0, dayPlan.fatG - fatLogged),
  };
}

export async function logFoodAction(input: {
  date?: string;
  timeSlot: string;
  description: string;
  kcal: number;
  proteinG: number;
  carbsG?: number;
  fatG?: number;
  source: "quick" | "manual" | "ai";
}) {
  await db.insert(foodLogs).values({
    date: input.date ?? todayManilaISO(),
    timeSlot: input.timeSlot,
    description: input.description,
    kcal: Math.round(input.kcal),
    proteinG: String(input.proteinG),
    carbsG: input.carbsG !== undefined ? String(input.carbsG) : null,
    fatG: input.fatG !== undefined ? String(input.fatG) : null,
    source: input.source,
  });
  revalidatePath("/fuel");
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function deleteFoodLogAction(id: number) {
  await db.delete(foodLogs).where(eq(foodLogs.id, id));
  revalidatePath("/fuel");
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function logWaterAction(ml: number, date?: string) {
  await db.insert(waterLogs).values({ date: date ?? todayManilaISO(), ml });
  revalidatePath("/fuel");
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function deleteWaterLogAction(id: number) {
  await db.delete(waterLogs).where(eq(waterLogs.id, id));
  revalidatePath("/fuel");
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

export type MealReviewSource = "ai" | "manual" | "quick";

export type MealReviewItem = {
  timeSlot: string;
  name: string;
  portionDesc: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: "high" | "medium" | "low" | null;
  assumptions: string;
  source: MealReviewSource;
};

/** Estimates macros for everything described in `text` via Groq; falls back to
 * the original regex+USDA match (auto-picking the best candidate) when the AI
 * call is unavailable, so Quick Log never breaks. Nothing is saved here. */
export async function estimateMealAction(text: string): Promise<{ items: MealReviewItem[]; usedAi: boolean }> {
  const defaultSlot = defaultTimeSlotForHour(manilaHourNow());

  const budget = await buildMacroBudgetContext();
  const aiItems = await estimateMacros(text, budget);
  if (aiItems) {
    return {
      usedAi: true,
      items: aiItems.map((it) => ({
        timeSlot: it.timeSlot ?? defaultSlot,
        name: it.name,
        portionDesc: it.portionDesc,
        kcal: it.kcal,
        proteinG: it.proteinG,
        carbsG: it.carbsG,
        fatG: it.fatG,
        confidence: it.confidence,
        assumptions: it.assumptions,
        source: "ai",
      })),
    };
  }

  const parsed = parseMealText(text, defaultSlot);
  const items = await Promise.all(
    parsed.map(async (p): Promise<MealReviewItem> => {
      const candidates = await searchFood(p.foodText, 1);
      const best: FoodCandidate | undefined = candidates[0];
      return {
        timeSlot: p.timeSlot,
        name: p.foodText,
        portionDesc: best?.description ?? "",
        kcal: best?.kcal != null ? Math.round(best.kcal) : 0,
        proteinG: best?.proteinG != null ? Math.round(best.proteinG * 10) / 10 : 0,
        carbsG: best?.carbsG != null ? Math.round(best.carbsG * 10) / 10 : 0,
        fatG: best?.fatG != null ? Math.round(best.fatG * 10) / 10 : 0,
        confidence: best ? "low" : null,
        assumptions: best
          ? "USDA per-100g match (AI estimation unavailable) — check the portion."
          : "No USDA match — enter macros manually.",
        source: "quick",
      };
    })
  );
  return { usedAi: false, items };
}

/** Re-estimates a single item with an optional hint. Returns null if the AI call is unavailable. */
export async function rethinkItemAction(
  name: string,
  portionDesc: string,
  hint: string
): Promise<AiMacroItem | null> {
  const budget = await buildMacroBudgetContext();
  return rethinkMacroItem(name, portionDesc, hint, budget);
}

export async function logMealBatchAction(
  items: {
    timeSlot: string;
    description: string;
    kcal: number;
    proteinG: number;
    carbsG?: number;
    fatG?: number;
    source: MealReviewSource;
  }[]
) {
  const today = todayManilaISO();
  if (items.length === 0) return;
  await db.insert(foodLogs).values(
    items.map((item) => ({
      date: today,
      timeSlot: item.timeSlot,
      description: item.description,
      kcal: Math.round(item.kcal),
      proteinG: String(item.proteinG),
      carbsG: item.carbsG !== undefined ? String(item.carbsG) : null,
      fatG: item.fatG !== undefined ? String(item.fatG) : null,
      source: item.source,
    }))
  );
  revalidatePath("/fuel");
  revalidatePath("/home");
  updateTag("analytics-data");
  updateTag("home-data");
}

export async function logWeighInAction(kg: number, date?: string) {
  const d = date ?? todayManilaISO();
  await db
    .insert(weighIns)
    .values({ date: d, kg: String(kg) })
    .onConflictDoUpdate({ target: weighIns.date, set: { kg: String(kg) } });
  revalidatePath("/fuel");
  revalidatePath("/home");
  revalidatePath("/analytics");
  updateTag("analytics-data");
  updateTag("home-data");
}
