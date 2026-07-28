// §6d's 8 category tiles. Every sourceType that can ever land in
// memory_chunks (the 16 backfilled types from §6a, plus the two live
// sourceTypes rememberChunk already writes -- "capture" from the pipeline,
// "journal" from Phase 5) is mapped here so no chunk is ever uncategorized.
export const BRAIN_CATEGORIES = ["Swim", "Gym", "Fuel", "School", "Business", "Health", "Ideas", "Life admin"] as const;
export type BrainCategory = (typeof BRAIN_CATEGORIES)[number];

const SOURCE_TYPE_CATEGORY: Record<string, BrainCategory> = {
  swim_session: "Swim",
  swim_time: "Swim",
  meet: "Swim",
  meet_event: "Swim",
  workout_log: "Gym",
  food_log: "Fuel",
  canvas_assignment: "School",
  business_task: "Business",
  business_note: "Business",
  sleep_log: "Health",
  soreness_log: "Health",
  weigh_in: "Health",
  journal: "Health",
  knowledge: "Ideas",
  ai_takeaway: "Life admin",
  coach_message: "Life admin",
  daily_brief: "Life admin",
  capture: "Life admin",
};

export function categoryForSourceType(sourceType: string): BrainCategory {
  return SOURCE_TYPE_CATEGORY[sourceType] ?? "Life admin";
}

export function sourceTypesForCategory(category: BrainCategory): string[] {
  return Object.entries(SOURCE_TYPE_CATEGORY)
    .filter(([, cat]) => cat === category)
    .map(([type]) => type);
}

/** Where a Brain result links back to -- a real per-row page where this app
 * has one (swim sessions, businesses), otherwise that type's general list
 * page. `knowledge` (synced Obsidian notes) has no in-app viewer, so it's
 * the one type with no href. */
export function resolveSourceHref(sourceType: string, sourceId: string, metadata: Record<string, unknown> | null): string | null {
  switch (sourceType) {
    case "swim_session":
      return `/swim/session/${sourceId}`;
    case "swim_time":
    case "meet":
    case "meet_event":
      return "/swim";
    case "workout_log":
      return "/train";
    case "food_log":
      return "/fuel";
    case "canvas_assignment":
      return "/school";
    case "business_task":
    case "business_note": {
      const businessId = metadata?.businessId;
      return businessId ? `/business/${businessId}` : "/business";
    }
    case "sleep_log":
    case "soreness_log":
    case "weigh_in":
      return "/more/recovery";
    case "journal":
      return "/life/journal";
    case "ai_takeaway":
      return "/more/settings";
    case "coach_message":
      return "/more/coach-ai";
    case "daily_brief":
      return "/home";
    case "capture":
      return "/life/crm";
    case "knowledge":
    default:
      return null;
  }
}
