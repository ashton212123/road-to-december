export type QuickAddFood = {
  id: string;
  name: string;
  serving: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  category: "plan" | "filipino";
};

// Macro estimates for common servings — reasonable references, not lab
// values. Good enough for a training-log macro budget.
export const FOOD_LIBRARY: QuickAddFood[] = [
  // Plan-suggested meals (from /data/road_to_december_data.json MEALS)
  { id: "plan-pre-race-pace", name: "Banana or bread + water (pre race-pace)", serving: "1 banana + 1 slice bread", kcal: 184, proteinG: 4, carbsG: 42, fatG: 1.4, category: "plan" },
  { id: "plan-breakfast", name: "Eggs + rice breakfast", serving: "2 eggs + 1.5 cups rice", kcal: 464, proteinG: 19, carbsG: 68, fatG: 11, category: "plan" },
  { id: "plan-gap-snack", name: "Milk + banana (swim→gym gap)", serving: "1 cup milk + 1 banana", kcal: 254, proteinG: 9, carbsG: 39, fatG: 8.4, category: "plan" },
  { id: "plan-dinner", name: "Full dinner + protein (rice, meat, veg)", serving: "~2 cups rice + 200g protein + veg", kcal: 820, proteinG: 55, carbsG: 90, fatG: 22, category: "plan" },

  // Common Filipino staples with macros
  { id: "rice-cup", name: "Rice", serving: "1 cup cooked", kcal: 205, proteinG: 4.3, carbsG: 45, fatG: 0.4, category: "filipino" },
  { id: "egg", name: "Egg", serving: "1 large", kcal: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3, category: "filipino" },
  { id: "chicken-breast", name: "Chicken breast", serving: "100g cooked", kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, category: "filipino" },
  { id: "chicken-thigh", name: "Chicken thigh", serving: "100g cooked", kcal: 209, proteinG: 26, carbsG: 0, fatG: 10.9, category: "filipino" },
  { id: "adobo", name: "Chicken adobo", serving: "1 cup", kcal: 350, proteinG: 28, carbsG: 8, fatG: 22, category: "filipino" },
  { id: "bangus", name: "Bangus (milkfish, grilled)", serving: "100g", kcal: 200, proteinG: 20, carbsG: 0, fatG: 13, category: "filipino" },
  { id: "milk", name: "Milk", serving: "1 cup", kcal: 149, proteinG: 7.7, carbsG: 12, fatG: 8, category: "filipino" },
  { id: "banana", name: "Banana", serving: "1 medium", kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, category: "filipino" },
  { id: "bread", name: "Bread", serving: "1 slice", kcal: 79, proteinG: 2.7, carbsG: 15, fatG: 1, category: "filipino" },
  { id: "protein-scoop", name: "Whey protein scoop", serving: "1 scoop (~30g)", kcal: 120, proteinG: 24, carbsG: 3, fatG: 1.5, category: "filipino" },
];
