import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiTakeaways } from "@/lib/db/schema";
import { callGroqChat } from "@/lib/ai/groq";

const CACHE_KEY = "athlete-model";

const SYSTEM_PROMPT = `You maintain a persistent athlete model for Ashton (63kg swimmer, 200 breast focus, NCAA Dec 4). Merge today's data into the existing model. Keep ONLY durable facts: recurring soreness patterns, exercise preferences/aversions, schedule constraints, nutrition habits, injury history, what motivates him. Drop day-noise. Max 10 bullet lines, max 900 chars total. Output only the bullets.`;

/** The latest persisted athlete model, or null if none exists yet (first
 * run, or every refresh so far has failed/skipped). Reused by both the
 * chat context and the daily brief -- one shared "memory" both consumers
 * read the same way, no separate storage for either. */
export async function getAthleteModel(): Promise<string | null> {
  const rows = await db
    .select()
    .from(aiTakeaways)
    .where(eq(aiTakeaways.key, CACHE_KEY))
    .orderBy(desc(aiTakeaways.date))
    .limit(1);
  return rows[0]?.message ?? null;
}

/** Folds today's context into the athlete model and persists a new dated
 * row (one row per calendar day the model actually changes -- the existing
 * date+key unique index on ai_takeaways keeps a second call the same day a
 * silent no-op). Never throws: a Groq error or DB hiccup here must not
 * block whatever caller is generating the daily brief, so failures just
 * leave the previous model as the latest one. */
export async function refreshAthleteModel(
  today: string,
  previousModel: string | null,
  todayContextText: string
): Promise<void> {
  try {
    // Same-day idempotency check up front -- skip the Groq call entirely if
    // today's row already exists (the daily-brief gate should already
    // prevent this, but a second caller landing the same day must not cost
    // a redundant call).
    const already = await db
      .select({ id: aiTakeaways.id })
      .from(aiTakeaways)
      .where(and(eq(aiTakeaways.date, today), eq(aiTakeaways.key, CACHE_KEY)))
      .limit(1);
    if (already.length > 0) return;

    const userContent = `Previous model:\n${previousModel ?? "(none yet -- this is the first entry)"}\n\nToday's context (JSON):\n${todayContextText}`;
    const result = await callGroqChat([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ]);
    if (!result.ok) return;

    const trimmed = result.content.trim().slice(0, 900);
    if (!trimmed) return;

    await db.insert(aiTakeaways).values({ date: today, key: CACHE_KEY, message: trimmed }).onConflictDoNothing();
  } catch {
    // Keep the previous model as the latest one; never block a caller.
  }
}
