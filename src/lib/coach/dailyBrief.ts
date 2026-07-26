import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyBriefs } from "@/lib/db/schema";
import { callGroqChat } from "@/lib/ai/groq";
import { getAthleteModel, refreshAthleteModel } from "@/lib/coach/athleteModel";

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
  /** Most recent logged swim session types, oldest to newest (e.g. ["Aerobic
   * session", "Threshold session", "Recovery session"]) -- lets the brief
   * reference real training rhythm instead of inventing one. Empty if none
   * logged yet. */
  recentSessionTypes: string[];
};

// Loop 39.3: same event-profile line used in sessionAnalysis.ts's and
// aiSession.ts's system prompts, so the coach voice never contradicts what
// the swim-analysis AI already knows about him.
const ATHLETE_EVENT_PROFILE =
  "a 17-year-old breaststroke and 400 IM specialist (bests: 30.73 / 1:05.87 / 2:24.83 LCM breast; 2:10.86 200 IM; ~4:47 400 IM) who trains SCM and races LCM";

const SYSTEM_PROMPT = `You are the in-app coach voice for ${ATHLETE_EVENT_PROFILE}'s training tracker. Every morning you write ONE short brief (1-2 sentences, under 220 characters) that greets the athlete with something concrete and specific from today's data.

Rules:
- Hard ban on motivational language. Never write "you've got this," "keep pushing," "crush it," "let's go," "amazing," "great job," or any equivalent in that spirit -- not even reworded. Every sentence states a fact, a number, or a mechanism, never encouragement.
- Reference at least one specific number or fact from the context (consistency %, days to meet, a trend, today's session name, or recentSessionTypes).
- recentSessionTypes is the real sequence of what he's actually swum lately, oldest to newest -- you may reference it factually (e.g. what today's session adds after that pattern) but never frame it as praise or a warning dressed as encouragement.
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
    recentSessionTypes: ctx.recentSessionTypes,
    activeAlertHeadlines: ctx.activeAlertHeadlines,
    athleteStatus:
      ctx.trainingStatus === "healthy"
        ? "healthy"
        : `${ctx.trainingStatus} since ${ctx.trainingStatusSince} -- adjust tone: recovery-first, zero pressure about missed sessions`,
  });
}

async function generateDailyBrief(ctx: DailyBriefContext, athleteModel: string | null): Promise<string | null> {
  const systemContent = [SYSTEM_PROMPT, athleteModel ? `ATHLETE MODEL (persistent):\n${athleteModel}` : ""]
    .filter(Boolean)
    .join("\n\n");
  const content = await callGroqChat(
    [
      { role: "system", content: systemContent },
      { role: "user", content: buildUserContent(ctx) },
    ],
    { temperature: 0.6 }
  );
  if (!content) return null;
  const trimmed = content.trim().replace(/^"|"$/g, "");
  return trimmed.length > 0 ? trimmed.slice(0, 300) : null;
}

/** Returns today's cached brief if one exists, otherwise generates and persists one. Returns null if Groq is unavailable or fails -- callers render nothing rather than a broken state.
 *
 * Piggybacks the athlete-model refresh on this same "first request of the
 * day" gate (the `cached.length > 0` early return above) so it runs at
 * most once/day without needing its own separate cache check. */
export async function getDailyBrief(ctx: DailyBriefContext): Promise<string | null> {
  const cached = await db.select().from(dailyBriefs).where(eq(dailyBriefs.date, ctx.today)).limit(1);
  if (cached.length > 0) return cached[0].message;

  const athleteModel = await getAthleteModel();
  const generated = await generateDailyBrief(ctx, athleteModel);
  if (!generated) return null;

  await db.insert(dailyBriefs).values({ date: ctx.today, message: generated }).onConflictDoNothing();
  await refreshAthleteModel(ctx.today, athleteModel, buildUserContent(ctx));
  return generated;
}
