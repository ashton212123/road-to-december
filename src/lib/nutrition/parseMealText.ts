/**
 * Splits free text like "lunch: chicken rice, creatine, dinner adobo" into
 * per-meal food items. Recognizes known time-slot keywords (with or without
 * a trailing colon) as segment markers; anything before the first keyword
 * (or the whole string, if no keyword is found) falls under defaultTimeSlot.
 * Within each segment, items are comma-separated.
 */

const SLOT_KEYWORDS: { tag: string; pattern: string }[] = [
  { tag: "pre_race_pace", pattern: "pre[\\s-]?race(?:[\\s-]?pace)?" },
  { tag: "breakfast", pattern: "breakfast" },
  { tag: "lunch", pattern: "lunch" },
  { tag: "pre_gym", pattern: "pre[\\s-]?gym" },
  { tag: "dinner", pattern: "dinner|supper" },
  { tag: "bedtime", pattern: "bedtime" },
  { tag: "snack", pattern: "snacks?" },
];

const MARKER_RE = new RegExp(`\\b(${SLOT_KEYWORDS.map((s) => s.pattern).join("|")})\\b\\s*:?\\s*`, "gi");

export type ParsedMealItem = { timeSlot: string; foodText: string };

function tagFor(matchedWord: string): string {
  const lower = matchedWord.toLowerCase();
  const found = SLOT_KEYWORDS.find((s) => new RegExp(`^(${s.pattern})$`, "i").test(lower));
  return found ? found.tag : lower;
}

/** Best-guess default time slot from the current hour, used when the input has no slot keyword at all. */
export function defaultTimeSlotForHour(hour: number): string {
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 19) return "pre_gym";
  if (hour < 22) return "dinner";
  return "snack";
}

export function parseMealText(text: string, defaultTimeSlot: string): ParsedMealItem[] {
  const matches = [...text.matchAll(MARKER_RE)];
  const items: ParsedMealItem[] = [];

  function pushSegment(timeSlot: string, body: string) {
    for (const raw of body.split(",")) {
      const foodText = raw.trim();
      if (foodText) items.push({ timeSlot, foodText });
    }
  }

  if (matches.length === 0) {
    pushSegment(defaultTimeSlot, text);
    return items;
  }

  // Text before the first marker (if any) still belongs somewhere -- attach to defaultTimeSlot.
  const firstMatch = matches[0];
  if (firstMatch.index !== undefined && firstMatch.index > 0) {
    const lead = text.slice(0, firstMatch.index);
    if (lead.trim()) pushSegment(defaultTimeSlot, lead);
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const tag = tagFor(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
    pushSegment(tag, text.slice(start, end));
  }

  return items;
}
