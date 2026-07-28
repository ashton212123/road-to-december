import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";
import type { JournalEntry } from "@/lib/db/schema";

/** Reverse-chronological, single query -- no batching needed (§3.1 only
 * requires batching multi-round-trip work; this is already one round trip). */
export async function getJournalEntries(limit = 60): Promise<JournalEntry[]> {
  return db.select().from(journalEntries).orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt)).limit(limit);
}
