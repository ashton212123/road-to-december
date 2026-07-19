import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiTakeaways } from "@/lib/db/schema";
import { callGroqChat } from "@/lib/ai/groq";

const CACHE_KEY = "strength-plateau";

const SYSTEM_PROMPT = `You are a strength coach reviewing a competitive swimmer's estimated 1RM trends on their main lifts (back squat, trap-bar deadlift). You'll get each lift's recent e1RM history as [date, kg] pairs.

Write ONE short sentence (under 180 characters) diagnosing the overall trend -- plateauing, progressing, or too little recent data to tell. Name the specific lift if only one shows a clear pattern; speak generally if lifts disagree. Be direct and specific (cite a number or timeframe), not generic encouragement. Plain text only, no markdown, no quotes.`;

/** Returns today's cached plateau diagnosis if one exists, otherwise generates and persists one. Returns null if Groq is unavailable, fails, or there's not enough data to be worth a call. */
export async function getStrengthTakeaway(
  today: string,
  e1rmByLift: Record<string, { date: string; e1rm: number }[]>
): Promise<string | null> {
  const liftsWithData = Object.entries(e1rmByLift).filter(([, points]) => points.length >= 2);
  if (liftsWithData.length === 0) return null;

  const cached = await db
    .select()
    .from(aiTakeaways)
    .where(and(eq(aiTakeaways.date, today), eq(aiTakeaways.key, CACHE_KEY)))
    .limit(1);
  if (cached.length > 0) return cached[0].message;

  const userContent = JSON.stringify(
    Object.fromEntries(liftsWithData.map(([lift, points]) => [lift, points.slice(-8).map((p) => [p.date, p.e1rm])]))
  );
  const content = await callGroqChat([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ]);
  if (!content) return null;

  const trimmed = content.trim().replace(/^"|"$/g, "").slice(0, 250);
  if (!trimmed) return null;

  await db.insert(aiTakeaways).values({ date: today, key: CACHE_KEY, message: trimmed }).onConflictDoNothing();
  return trimmed;
}
