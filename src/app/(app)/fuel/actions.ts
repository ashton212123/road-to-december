"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { foodLogs, waterLogs, weighIns } from "@/lib/db/schema";
import { todayManilaISO, manilaHourNow } from "@/lib/time";
import { parseMealText, defaultTimeSlotForHour } from "@/lib/nutrition/parseMealText";
import { searchFood, type FoodCandidate } from "@/lib/nutrition/usda";
import { estimateMacros, rethinkMacroItem, type AiMacroItem } from "@/lib/nutrition/aiMacros";

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
}

export async function deleteFoodLogAction(id: number) {
  await db.delete(foodLogs).where(eq(foodLogs.id, id));
  revalidatePath("/fuel");
  revalidatePath("/home");
}

export async function logWaterAction(ml: number, date?: string) {
  await db.insert(waterLogs).values({ date: date ?? todayManilaISO(), ml });
  revalidatePath("/fuel");
  revalidatePath("/home");
}

export async function deleteWaterLogAction(id: number) {
  await db.delete(waterLogs).where(eq(waterLogs.id, id));
  revalidatePath("/fuel");
  revalidatePath("/home");
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

  const aiItems = await estimateMacros(text);
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
  return rethinkMacroItem(name, portionDesc, hint);
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
}
