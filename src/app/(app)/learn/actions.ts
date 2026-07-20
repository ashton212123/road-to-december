"use server";

import { revalidatePath, updateTag } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { learnProgress } from "@/lib/db/schema";

export async function toggleLearnLevelAction(trackId: string, levelKey: string, completed: boolean) {
  if (completed) {
    await db.insert(learnProgress).values({ trackId, levelKey }).onConflictDoNothing();
  } else {
    await db.delete(learnProgress).where(and(eq(learnProgress.trackId, trackId), eq(learnProgress.levelKey, levelKey)));
  }
  revalidatePath("/learn");
  revalidatePath(`/learn/${trackId}`);
  updateTag("learn-data");
}
