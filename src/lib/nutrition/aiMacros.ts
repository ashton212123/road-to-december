/**
 * AI macro estimation via Groq's free tier. Every export here is best-effort:
 * a missing key, a network error, or a malformed model response all resolve
 * to `null` rather than throwing, so a caller can always fall back to the
 * regex+USDA path (see fuel/actions.ts) and the quick-log feature never breaks.
 */

import { callGroqChat } from "@/lib/ai/groq";

export type AiConfidence = "high" | "medium" | "low";

export type AiMacroItem = {
  timeSlot?: string;
  name: string;
  portionDesc: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: AiConfidence;
  assumptions: string;
};

const VALID_TIME_SLOTS = ["pre_race_pace", "breakfast", "lunch", "pre_gym", "dinner", "snack", "bedtime"];

const SYSTEM_PROMPT = `You are a sports-nutrition macro estimator for a 63kg competitive swimmer training in the Philippines, prepping for an NCAA meet. The athlete will describe what they ate in free text, sometimes across multiple meals in one message.

You know Filipino food well: adobo, sinigang, tocino, tapsilog-style meals, silog rice portions, lechon, pancit, halo-halo, etc. Rice is usually described in cups (1 cup cooked rice ≈ 200g ≈ 260 kcal) — assume standard restaurant/home portions unless the athlete specifies otherwise, and use realistic COOKED weights, not raw.

For each distinct food/meal item in the message, return one entry with your best estimate. Always state your portion assumption in one short clause (e.g. "assumed 1.5 cups cooked rice ≈ 280g"). If the athlete names a time of day or meal (breakfast/lunch/dinner/pre_gym/snack/bedtime/pre_race_pace), set timeSlot to the closest match from that exact set; otherwise omit timeSlot entirely and let the caller default it.

Rate your own confidence: "high" for common, well-specified foods; "medium" for reasonable guesses on ambiguous portions; "low" for vague or unusual descriptions.

Respond with ONLY a JSON object of this exact shape, no other text:
{"items": [{"timeSlot": "lunch", "name": "Chicken adobo", "portionDesc": "1.5 cups rice + 200g chicken adobo", "kcal": 650, "proteinG": 35, "carbsG": 70, "fatG": 22, "confidence": "medium", "assumptions": "assumed 1.5 cups cooked rice and a standard adobo serving with skin-on thigh"}]}`;

function normalizeItem(raw: unknown): AiMacroItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.name !== "string" || !r.name.trim()) return null;

  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
  const timeSlot = typeof r.timeSlot === "string" && VALID_TIME_SLOTS.includes(r.timeSlot) ? r.timeSlot : undefined;
  const confidence: AiConfidence = r.confidence === "high" || r.confidence === "low" ? r.confidence : "medium";

  return {
    timeSlot,
    name: r.name.trim(),
    portionDesc: typeof r.portionDesc === "string" ? r.portionDesc : "",
    kcal: Math.round(num(r.kcal)),
    proteinG: Math.round(num(r.proteinG) * 10) / 10,
    carbsG: Math.round(num(r.carbsG) * 10) / 10,
    fatG: Math.round(num(r.fatG) * 10) / 10,
    confidence,
    assumptions: typeof r.assumptions === "string" ? r.assumptions : "",
  };
}

async function callGroq(userContent: string): Promise<AiMacroItem[] | null> {
  const content = await callGroqChat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    { jsonMode: true, temperature: 0.2 }
  );
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as { items?: unknown[] } | unknown[];
    const rawItems = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(rawItems)) return null;

    const items = rawItems.map(normalizeItem).filter((x): x is AiMacroItem => x !== null);
    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

/** Estimates macros for every food item described in `text`. Returns null (never throws) if GROQ_API_KEY is unset or the call fails for any reason. */
export function estimateMacros(text: string): Promise<AiMacroItem[] | null> {
  return callGroq(text);
}

/** Re-estimates a single item, optionally steered by a user hint (e.g. "bigger serving", "no oil"). Returns the first item from the model's response. */
export async function rethinkMacroItem(
  currentName: string,
  currentPortionDesc: string,
  hint: string
): Promise<AiMacroItem | null> {
  const userContent = [
    `Re-estimate this single food item: "${currentName}"${currentPortionDesc ? ` (previously: ${currentPortionDesc})` : ""}.`,
    hint.trim() ? `Additional context from the athlete: ${hint.trim()}` : "",
    "Return exactly one item in the items array.",
  ]
    .filter(Boolean)
    .join(" ");
  const items = await callGroq(userContent);
  return items?.[0] ?? null;
}
