"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { foodLogs, waterLogs, weighIns } from "@/lib/db/schema";
import { todayManilaISO, manilaHourNow } from "@/lib/time";
import { parseMealText, defaultTimeSlotForHour } from "@/lib/nutrition/parseMealText";
import { searchFood, type FoodCandidate } from "@/lib/nutrition/usda";

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

export type ParsedMealReviewItem = {
  timeSlot: string;
  foodText: string;
  candidates: FoodCandidate[];
};

/** Parses free-text meal input and enriches each item with fuzzy-matched USDA
 * candidates, for an editable review step before anything is saved. */
export async function parseMealTextAction(text: string): Promise<ParsedMealReviewItem[]> {
  const items = parseMealText(text, defaultTimeSlotForHour(manilaHourNow()));
  return Promise.all(
    items.map(async (item) => ({
      ...item,
      candidates: await searchFood(item.foodText, 3),
    }))
  );
}

export async function logMealBatchAction(
  items: { timeSlot: string; description: string; kcal: number; proteinG: number; carbsG?: number; fatG?: number }[]
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
      source: "quick" as const,
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
