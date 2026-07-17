/**
 * USDA FoodData Central client. Free, no paid LLM calls -- uses the public
 * DEMO_KEY (works out of the box, ~30 req/hour/IP limit) unless USDA_FDC_API_KEY
 * is set. A real key is a free 2-minute signup at
 * https://fdc.nal.usda.gov/api-key-signup (no payment, no account needed
 * beyond an email) -- worth getting for real usage since DEMO_KEY's rate
 * limit is easy to hit. See DECISIONS.md.
 */

const BASE_URL = "https://api.nal.usda.gov/fdc/v1";

export type FoodCandidate = {
  fdcId: number;
  description: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

function apiKey(): string {
  return process.env.USDA_FDC_API_KEY || "DEMO_KEY";
}

function extractNutrient(nutrients: { nutrientName?: string; unitName?: string; value?: number }[], name: string): number | null {
  const match = nutrients.find((n) => n.nutrientName?.toLowerCase() === name.toLowerCase());
  return match?.value ?? null;
}

export async function searchFood(query: string, limit = 5): Promise<FoodCandidate[]> {
  const url = `${BASE_URL}/foods/search?query=${encodeURIComponent(query)}&pageSize=${limit}&api_key=${apiKey()}`;
  let res: Response;
  try {
    res = await fetch(url, { cache: "no-store" });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const data = (await res.json()) as { foods?: { fdcId: number; description: string; foodNutrients?: { nutrientName?: string; unitName?: string; value?: number }[] }[] };
  return (data.foods ?? []).map((f) => {
    const nutrients = f.foodNutrients ?? [];
    return {
      fdcId: f.fdcId,
      description: f.description,
      kcal: extractNutrient(nutrients, "Energy"),
      proteinG: extractNutrient(nutrients, "Protein"),
      carbsG: extractNutrient(nutrients, "Carbohydrate, by difference"),
      fatG: extractNutrient(nutrients, "Total lipid (fat)"),
    };
  });
}
