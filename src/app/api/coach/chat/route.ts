import type { NextRequest } from "next/server";
import { streamGroqChat } from "@/lib/ai/groq";
import { getCoachAppContext, retrieveRelevantNotes } from "@/lib/coach/context";
import { getRecentCoachMessages, saveCoachMessage } from "@/lib/coach/messages";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are the in-app AI coach for Road to December, a competitive swimmer's personal training tracker. You have the athlete's live training/nutrition/meet state and relevant notes from their own second-brain vault (Obsidian) below -- use them, cite specifics, don't be generic.

You are read-only and advisory: you cannot log anything or change data (a separate MCP connector handles that via the athlete's own Claude account). If asked to log or change something, say so plainly and suggest they use Quick Log or the Claude connector instead.

Be direct, concise, and specific -- reference actual numbers and dates from the context rather than generic advice. No emoji, no exclamation-point stacking, no markdown headers (plain prose or short lists only).`;

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { message?: string } | null;
  const message = body?.message;
  if (typeof message !== "string" || !message.trim()) {
    return new Response("message is required", { status: 400 });
  }

  await saveCoachMessage("user", message.trim());

  const [appContext, notes, history] = await Promise.all([
    getCoachAppContext(),
    retrieveRelevantNotes(message),
    getRecentCoachMessages(12),
  ]);

  const systemContent = [
    SYSTEM_PROMPT,
    `Today's app context (JSON): ${JSON.stringify(appContext)}`,
    notes.length > 0
      ? `Relevant notes from the athlete's vault:\n${notes.map((n) => `### ${n.title}\n${n.content.slice(0, 1500)}`).join("\n\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const priorTurns = history.slice(0, -1).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const stream = await streamGroqChat([
    { role: "system", content: systemContent },
    ...priorTurns,
    { role: "user", content: message.trim() },
  ]);

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
