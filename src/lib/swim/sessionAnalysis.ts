/**
 * One Groq call at save time, generating a three-paragraph physiological
 * read of a single session -- stored on swim_sessions.aiAnalysis and never
 * regenerated on page load. Falls back to a deterministic rule-based
 * paragraph (built from data already computed, never Groq) so the page
 * never shows an empty analysis slot.
 */

import { callGroqChat } from "@/lib/ai/groq";
import { ZONES, type ZoneDistance } from "./zones";
import type { SessionClassification } from "./sessionType";
import type { Course } from "./course";
import type { CriticalSpeed } from "./criticalSpeed";
import type { SwimSessionInterval } from "@/lib/db/schema";

const SYSTEM_PROMPT = `You are a swimming physiologist analysing ONE training session for a 17-year-old breaststroke and 400 IM specialist (bests: 30.73 / 1:05.87 / 2:24.83 LCM breast; 2:10.86 200 IM; ~4:47 400 IM). He trains SCM, races LCM.

Write exactly three short paragraphs, no headings, no bullets, no praise, no motivation.

1. WHAT THIS SESSION WAS: name the physiological system it loaded and why the zone distribution says so. Reference actual metres.
2. WHAT IT DOES FOR HIS EVENTS: connect it specifically to 50/100/200 breaststroke or the 400 IM. Be concrete about mechanism (e.g. threshold work raises the pace sustainable before lactate accumulates, which is what the 400 IM's ~4.5-minute aerobic demand is limited by). If the session does little for his events, say that plainly.
3. WHAT IT MEANS FOR THE NEXT 48 HOURS: given the recent session-type sequence provided, state what should and should not come next, and why physiologically.

Rules: never invent a number not given to you. Never give motivational language. If the data is thin, say which data is missing. If evidence for a claim is weak or mixed, say so in the sentence.`;

function buildUserMessage(input: {
  classification: SessionClassification;
  zoneDistance: ZoneDistance;
  totalM: number;
  breastKickM: number;
  durationMin: number;
  sessionRpe: number;
  course: Course;
  intervals: SwimSessionInterval[];
  recentSessionTypes: { date: string; type: string }[];
  daysToNextMeet: number | null;
  criticalSpeed: CriticalSpeed | null;
}): string {
  const zoneLines = Object.entries(input.zoneDistance)
    .filter(([, m]) => (m ?? 0) > 0)
    .map(([z, m]) => `${z}: ${m}m`)
    .join(", ");
  const recentLines = input.recentSessionTypes.map((r) => `${r.date}: ${r.type}`).join("; ") || "no recent sessions logged";

  return [
    `Session type: ${input.classification.label} (${input.classification.why})`,
    `Total distance: ${input.totalM}m over ${input.durationMin} minutes, course ${input.course}`,
    `Zone distribution: ${zoneLines || "none recorded"}`,
    `Breaststroke kick metres: ${input.breastKickM}`,
    `Session RPE: ${input.sessionRpe}/10`,
    `Last 7 days of session types: ${recentLines}`,
    `Days to next meet: ${input.daysToNextMeet ?? "none scheduled"}`,
    `Critical speed anchor: ${input.criticalSpeed ? `${input.criticalSpeed.pacePer100Sec.toFixed(1)}s/100 (${input.criticalSpeed.method})` : "not available"}`,
  ].join("\n");
}

function fallbackAnalysis(classification: SessionClassification): string {
  const zoneEntries = Object.entries(classification.zoneDistance).filter(([, m]) => (m ?? 0) > 0);
  const purposes = zoneEntries.map(([z]) => ZONES[z as keyof typeof ZONES]?.purpose).filter(Boolean);
  return [
    `${classification.label}: ${classification.why}`,
    purposes.length > 0 ? purposes.join(" ") : "No zone breakdown available for this session.",
    "AI analysis unavailable for this session — this is a rule-based summary from the logged data only.",
  ].join(" ");
}

export async function generateSessionAnalysis(input: {
  classification: SessionClassification;
  zoneDistance: ZoneDistance;
  totalM: number;
  breastKickM: number;
  durationMin: number;
  sessionRpe: number;
  course: Course;
  intervals: SwimSessionInterval[];
  recentSessionTypes: { date: string; type: string }[];
  daysToNextMeet: number | null;
  criticalSpeed: CriticalSpeed | null;
}): Promise<string> {
  const content = await callGroqChat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(input) },
    ],
    { temperature: 0.3, timeoutMs: 20_000 }
  );
  return content?.trim() || fallbackAnalysis(input.classification);
}
