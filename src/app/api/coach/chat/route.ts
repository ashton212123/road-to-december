import type { NextRequest } from "next/server";
import { streamGroqChat, callGroqChatWithTools } from "@/lib/ai/groq";
import { getCoachAppContext, retrieveRelevantNotes } from "@/lib/coach/context";
import { getRecentCoachMessages, saveCoachMessage } from "@/lib/coach/messages";
import { COACH_TOOLS, executeCoachTool } from "@/lib/coach/tools";
import { withFallback } from "@/lib/db/withFallback";

export const maxDuration = 60;

export async function GET() {
  const history = await getRecentCoachMessages(20);
  return Response.json(history.map((m) => ({ role: m.role, content: m.content })));
}

const SYSTEM_PROMPT = `You are the in-app AI coach for Road to December, a competitive swimmer's personal training tracker. You have the athlete's live training/nutrition/meet state and relevant notes from their own second-brain vault (Obsidian) below -- use them, cite specifics, don't be generic.

You can log and edit the athlete's data directly via tools -- water, meals, sleep, weigh-ins, soreness, swim sessions/times, gym sets, water target, training status, and your own persistent memory of them. Use a tool whenever the athlete asks you to log, update, or undo something, rather than telling them to use a different screen. After any write, confirm what happened in one short line, including the resulting total or state (e.g. "Logged 500ml -- 2.1L today"). If an amount or detail is ambiguous, ask a clarifying question instead of guessing. Never invent data -- use get_today_summary if you need to check what's actually logged before answering.

Be direct, concise, and specific -- reference actual numbers and dates from the context rather than generic advice. No emoji, no exclamation-point stacking, no markdown headers (plain prose or short lists only).`;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message;
  if (typeof message !== "string" || !message.trim()) {
    return new Response("message is required", { status: 400 });
  }

  await saveCoachMessage("user", message.trim());

  // getCoachAppContext() already bounds its own 9 internal queries with
  // fallbacks; these two run concurrently alongside those 9 in the same
  // deliberately tiny connection pool (lib/db/index.ts) and need the same
  // protection -- an 11-way Promise.all against 3 connections was enough to
  // starve one arbitrary caller indefinitely before this was added.
  const [appContext, notes, history] = await Promise.all([
    getCoachAppContext(),
    withFallback(retrieveRelevantNotes(message), []),
    withFallback(getRecentCoachMessages(12), []),
  ]);

  const { athleteModel, ...liveContext } = appContext;

  const systemContent = [
    SYSTEM_PROMPT,
    athleteModel ? `ATHLETE MODEL (persistent):\n${athleteModel}` : "",
    `Today's app context (JSON): ${JSON.stringify(liveContext)}`,
    notes.length > 0
      ? `Relevant notes from the athlete's vault:\n${notes.map((n) => `### ${n.title}\n${n.content.slice(0, 1500)}`).join("\n\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const priorTurns = history.slice(0, -1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  const conversation = [
    { role: "system" as const, content: systemContent },
    ...priorTurns,
    { role: "user" as const, content: message.trim() },
  ];

  // Tool-calling path first -- the coach can act, not just advise. Falls
  // back to the plain streaming path (advisory only) if the tool loop is
  // unavailable, so a Groq hiccup degrades gracefully instead of erroring.
  const toolResult = await callGroqChatWithTools(conversation, COACH_TOOLS, executeCoachTool);
  if (toolResult !== null) {
    const trimmed = toolResult.trim();
    if (trimmed) await saveCoachMessage("assistant", trimmed);
    // Single-chunk stream so CoachChat's incremental reader needs zero
    // changes -- it just renders the whole answer as one "chunk" instead
    // of token-by-token.
    const body = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(trimmed);
        controller.close();
      },
    });
    return new Response(body.pipeThrough(new TextEncoderStream()), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const stream = await streamGroqChat(conversation);

  if (!stream) {
    return new Response("Coach is unavailable right now.", { status: 502 });
  }

  let fullResponse = "";
  const tee = stream.pipeThrough(
    new TransformStream<string, string>({
      transform(chunk, controller) {
        fullResponse += chunk;
        controller.enqueue(chunk);
      },
      async flush() {
        if (fullResponse.trim()) await saveCoachMessage("assistant", fullResponse.trim());
      },
    })
  );

  return new Response(tee.pipeThrough(new TextEncoderStream()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
