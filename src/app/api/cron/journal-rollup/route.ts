import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { aiTakeaways } from "@/lib/db/schema";
import { todayManilaISO, addDaysISO } from "@/lib/time";
import { callGroqChat } from "@/lib/ai/groq";

export const maxDuration = 30;

const ROLLUP_KEY = "journal-rollup";

/**
 * Vercel cron, nightly just after Manila midnight (see vercel.json) --
 * rolls up the day that JUST ended, not "today" (todayManilaISO() has
 * already ticked over by the time this fires). One factual sentence per day,
 * stored on ai_takeaways the same way the athlete-model takeaway already is
 * (date+key unique index, upsert-safe if the cron ever double-fires).
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const dateISO = addDaysISO(todayManilaISO(), -1);

  const rows = await db.execute(sql`
    select
      (select coalesce(json_agg(j), '[]') from (
        select summary, raw_text as "rawText", transcript from journal_entries where entry_date = ${dateISO}
      ) j) as "journal",
      (select count(*) from workout_logs where date = ${dateISO}) as "workoutCount",
      (select count(*) from swim_sessions where date = ${dateISO}) as "swimCount",
      (select coalesce(sum(kcal), 0) from food_logs where date = ${dateISO}) as "kcalTotal",
      (select coalesce(sum(protein_g), 0) from food_logs where date = ${dateISO}) as "proteinTotal"
  `);
  const data = rows[0] as unknown as {
    journal: { summary: string | null; rawText: string | null; transcript: string | null }[];
    workoutCount: number;
    swimCount: number;
    kcalTotal: number;
    proteinTotal: number;
  };

  const journalText = data.journal
    .map((j) => j.summary ?? j.transcript ?? j.rawText)
    .filter((t): t is string => Boolean(t))
    .join(" ");
  const factsLine = `Training: ${Number(data.workoutCount) > 0 ? "gym logged" : "no gym"}, ${
    Number(data.swimCount) > 0 ? "swim logged" : "no swim"
  }. Fuel: ${Math.round(Number(data.kcalTotal))} kcal, ${Math.round(Number(data.proteinTotal))}g protein.`;

  const prompt = journalText
    ? `Journal entry for the day: "${journalText}"\n\n${factsLine}\n\nWrite ONE factual sentence summarizing the day, weaving in the training/fuel facts above. Second person ("you"), no advice, no therapy voice.`
    : `No journal entry was logged. ${factsLine}\n\nWrite ONE factual sentence describing the day from these facts only. Second person, no advice.`;

  const summaryResult = await callGroqChat([{ role: "user", content: prompt }], { temperature: 0.3 });
  const message = (summaryResult.ok ? summaryResult.content.trim() : "") || factsLine;

  await db
    .insert(aiTakeaways)
    .values({ date: dateISO, key: ROLLUP_KEY, message })
    .onConflictDoUpdate({ target: [aiTakeaways.date, aiTakeaways.key], set: { message } });

  return Response.json({ date: dateISO, message });
}
