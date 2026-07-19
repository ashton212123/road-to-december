import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { coachMessages } from "@/lib/db/schema";

/** Most recent `limit` messages, oldest first -- used both for the page's initial render and for building the prompt's conversation history. */
export async function getRecentCoachMessages(limit = 20) {
  const rows = await db.select().from(coachMessages).orderBy(desc(coachMessages.createdAt)).limit(limit);
  return rows.reverse();
}

export async function saveCoachMessage(role: "user" | "assistant", content: string) {
  await db.insert(coachMessages).values({ role, content });
}
