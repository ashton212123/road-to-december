import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyBriefs } from "@/lib/db/schema";
import { callGroqChat } from "@/lib/ai/groq";

export type DailyBriefContext = {
  today: string;
  athleteWeightKg: number | null;
  weightTrendKg: number | null;
  kcalToday: number;
  kcalTargetMin: number;
  kcalTargetMax: number;
  proteinToday: number;
  proteinTargetMin: number;
  /** Rolling 4-week consistency %, null if nothing's been planned yet (V4 P3 -- replaces the old run-length streak). */
  consistencyPct: number | null;
  todaySessionTitle: string | null;
  todaySwim: string | null;
  daysToNcaa: number;
  daysToAsean: number | null;
  phaseTag: string;
  phaseName: string;
  loggedWorkoutToday: boolean;
  loggedSwimToday: boolean;
  activeAlertHeadlines: string[];
  trainingStatus: "healthy" | "sick" | "injured" | "break";
  trainingStatusSince: string | null;
};

const SYSTEM_PROMPT = `You are the in-app coach voice for a competitive swimmer's training tracker. Every morning you write ONE short brief (1-2 sentences, under 220 characters) that greets the athlete with something concrete and specific from today's data -- never generic motivational filler like "you've got this" or "keep pushing."

Rules:
- Reference at least one specific number or fact from the context (consistency %, days to meet, a trend, today's session name).
- If activeAlertHeadlines is non-empty, don't contradict them (e.g. don't praise nutrition if a "no food logged" alert is active) -- either acknowledge the gap briefly or steer clear of that topic entirely.
- If athleteStatus is not "healthy", the tone is recovery-first and there is zero pressure about missed sessions -- do not mention consistency %, streaks, or "getting back on track." Talk about the season/goal instead, warmly.
- Warm but direct, like a coach who knows the athlete's numbers, not a chatbot. No emoji, no exclamation-point stacking.
- Plain text only, no markdown, no quotes around the output.`;

function buildUserContent(ctx: DailyBriefContext): string {
  return JSON.stringify({
    daysToNcaa: ctx.daysToNcaa,
    daysToAsean: ctx.daysToAsean,
    phase: `${ctx.phaseTag} · ${ctx.phaseName}`,
    consistencyPct: ctx.consistencyPct,
    weightKg: ctx.athleteWeightKg,
    weightTrendKg: ctx.weightTrendKg,
    kcalToday: ctx.kcalToday,
    kcalTarget: [ctx.kcalTargetMin, ctx.kcalTargetMax],
    proteinTodayG: ctx.proteinToday,
    proteinTargetMinG: ctx.proteinTargetMin,
    todaySessionTitle: ctx.todaySessionTitle,
    todaySwim: ctx.todaySwim,
    loggedWorkoutToday: ctx.loggedWorkoutToday,
    loggedSwimToday: ctx.loggedSwimToday,
    activeAlertHeadlines: ctx.activeAlertHeadlines,
    athleteStatus:
      ctx.trainingStatus === "healthy"
        ? "healthy"
        : `${ctx.trainingStatus} since ${ctx.trainingStatusSince} -- adjust tone: recovery-first, zero pressure about missed sessions`,
  });
}

async function generateDailyBrief(ctx: DailyBriefContext): Promise<string | null> {
  const content = await callGroqChat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserContent(ctx) },
    ],
    { temperature: 0.6 }
  );
  if (!content) return null;
  const trimmed = content.trim().replace(/^"|"$/g, "");
  return trimmed.length > 0 ? trimmed.slice(0, 300) : null;
}

/** Returns today's cached brief if one exists, otherwise generates and persists one. Returns null if Groq is unavailable or fails -- callers render nothing rather than a broken state. */
export async function getDailyBrief(ctx: DailyBriefContext): Promise<string | null> {
  const cached = await db.select().from(dailyBriefs).where(eq(dailyBriefs.date, ctx.today)).limit(1);
  if (cached.length > 0) return cached[0].message;

  const generated = await generateDailyBrief(ctx);
  if (!generated) return null;

  await db.insert(dailyBriefs).values({ date: ctx.today, message: generated }).onConflictDoNothing();
  return generated;
}
