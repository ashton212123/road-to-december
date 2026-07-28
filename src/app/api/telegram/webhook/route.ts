import { timingSafeEqual } from "crypto";
import { after, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { rawCaptures, tasks } from "@/lib/db/schema";
import { runCapturePipeline, undoCapture, type RouteKind } from "@/lib/capture/pipeline";

export const maxDuration = 60;

const ROUTE_LABELS: Record<RouteKind, string> = {
  swim_session: "Swim session",
  swim_time: "Swim time",
  gym_set: "Gym set",
  meal: "Meal",
  water: "Water",
  sleep: "Sleep",
  weigh_in: "Weigh-in",
  soreness: "Soreness",
  task: "Task",
  journal: "Journal",
  note: "Note",
  coach_memory: "Coach memory",
};

type TelegramUser = { id: number };
type TelegramChat = { id: number };
type TelegramVoice = { file_id: string };
type TelegramMessage = {
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
  voice?: TelegramVoice;
  audio?: TelegramVoice;
};
type TelegramCallbackQuery = { id: string; from: TelegramUser; data?: string; message?: TelegramMessage };
type TelegramUpdate = { update_id: number; message?: TelegramMessage; callback_query?: TelegramCallbackQuery };

function botUrl(method: string): string {
  return `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;
}

async function sendMessage(chatId: number, text: string, replyMarkup?: unknown): Promise<void> {
  try {
    await fetch(botUrl("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup }),
    });
  } catch (err) {
    console.error("telegram webhook: sendMessage failed", err);
  }
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  try {
    await fetch(botUrl("answerCallbackQuery"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (err) {
    console.error("telegram webhook: answerCallbackQuery failed", err);
  }
}

function urgencyKeyboard(captureId: number) {
  return {
    inline_keyboard: [
      [
        { text: "Today", callback_data: `urgency:${captureId}:today` },
        { text: "This Week", callback_data: `urgency:${captureId}:week` },
      ],
      [
        { text: "This Month", callback_data: `urgency:${captureId}:month` },
        { text: "Someday", callback_data: `urgency:${captureId}:someday` },
      ],
      [
        { text: "★ Key", callback_data: `key:${captureId}` },
        { text: "Undo", callback_data: `undo:${captureId}` },
      ],
    ],
  };
}

/** Telegram sends voice notes as OGG -- the multipart filename/content-type
 * must say so, or Groq's transcription silently returns an empty string. */
async function transcribeVoice(fileId: string): Promise<string> {
  const fileRes = await fetch(botUrl("getFile") + `?file_id=${fileId}`);
  if (!fileRes.ok) return "";
  const fileData = (await fileRes.json()) as { result?: { file_path?: string } };
  const filePath = fileData.result?.file_path;
  if (!filePath) return "";

  const audioRes = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${filePath}`);
  if (!audioRes.ok) return "";
  const audioBuffer = await audioRes.arrayBuffer();

  const form = new FormData();
  form.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "voice.ogg");
  form.append("model", "whisper-large-v3-turbo");

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return "";
  try {
    const transcribeRes = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!transcribeRes.ok) return "";
    const data = (await transcribeRes.json()) as { text?: string };
    return typeof data.text === "string" ? data.text : "";
  } catch (err) {
    console.error("telegram webhook: transcription request failed", err);
    return "";
  }
}

async function handleMessage(message: TelegramMessage, updateId: number): Promise<void> {
  const chatId = message.chat.id;

  // Early dedupe (§3.4) -- before spending a transcription call on a
  // redelivered update. onConflictDoNothing below is the race-condition
  // safety net for two near-simultaneous deliveries both passing this check.
  const [alreadySeen] = await db
    .select({ id: rawCaptures.id })
    .from(rawCaptures)
    .where(eq(rawCaptures.telegramUpdateId, updateId))
    .limit(1);
  if (alreadySeen) return;

  let rawText: string | null = null;
  let transcript: string | null = null;
  let audioFileId: string | null = null;

  if (message.voice || message.audio) {
    audioFileId = (message.voice ?? message.audio)!.file_id;
    transcript = await transcribeVoice(audioFileId);
  } else if (message.text) {
    rawText = message.text;
  } else {
    await sendMessage(chatId, "Only text and voice messages are supported right now.");
    return;
  }

  const text = (transcript || rawText || "").trim();

  const inserted = await db
    .insert(rawCaptures)
    .values({ source: "telegram", telegramUpdateId: updateId, rawText, transcript, audioFileId, status: "pending" })
    .onConflictDoNothing({ target: rawCaptures.telegramUpdateId })
    .returning();

  if (inserted.length === 0) return; // lost the race to a duplicate delivery
  const captureId = inserted[0].id;

  if (!text) {
    await db
      .update(rawCaptures)
      .set({ status: "failed", error: "empty message: no text and transcription returned nothing" })
      .where(eq(rawCaptures.id, captureId));
    await sendMessage(chatId, "Got that, but there was nothing to log -- empty text, or the voice note didn't transcribe. The raw entry is saved, nothing was lost.");
    return;
  }

  let result: Awaited<ReturnType<typeof runCapturePipeline>>;
  try {
    result = await runCapturePipeline({ captureId, text, source: "telegram" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.update(rawCaptures).set({ status: "failed", error: message }).where(eq(rawCaptures.id, captureId));
    await sendMessage(chatId, `Something went wrong processing that, but the raw text is saved: "${text.slice(0, 200)}"`);
    return;
  }

  const lines =
    result.routedTo.length > 0
      ? [...new Set(result.routedTo)].map((k) => `✓ ${ROUTE_LABELS[k]}`).join("\n")
      : "Couldn't confidently route this -- saved as a note so nothing is lost.";
  const replyText = result.errors.length > 0 ? `${lines}\n\n(${result.errors.join("; ")})` : lines;

  await sendMessage(chatId, replyText, urgencyKeyboard(captureId));
}

async function taskIdsForCapture(captureId: number): Promise<number[]> {
  const [capture] = await db.select().from(rawCaptures).where(eq(rawCaptures.id, captureId)).limit(1);
  const routedIds = capture?.routedIds as Partial<Record<RouteKind, number[]>> | null;
  return routedIds?.task ?? [];
}

async function handleCallbackQuery(cb: TelegramCallbackQuery): Promise<void> {
  const [action, captureIdStr, extra] = (cb.data ?? "").split(":");
  const captureId = Number(captureIdStr);
  if (!action || !Number.isFinite(captureId)) {
    await answerCallbackQuery(cb.id, "Invalid action");
    return;
  }

  if (action === "undo") {
    const result = await undoCapture(captureId);
    await answerCallbackQuery(cb.id, result.ok ? "Undone" : (result.error ?? "Failed"));
    if (result.ok && cb.message) await sendMessage(cb.message.chat.id, "Undone -- everything that capture wrote has been removed.");
    return;
  }

  if (action === "urgency") {
    const urgency = extra as "today" | "week" | "month" | "someday" | undefined;
    if (!urgency || !["today", "week", "month", "someday"].includes(urgency)) {
      await answerCallbackQuery(cb.id, "Invalid urgency");
      return;
    }
    const taskIds = await taskIdsForCapture(captureId);
    for (const id of taskIds) {
      await db.update(tasks).set({ urgency }).where(eq(tasks.id, id));
    }
    await answerCallbackQuery(cb.id, taskIds.length > 0 ? `Set to ${urgency}` : "No task from this capture");
    return;
  }

  if (action === "key") {
    const taskIds = await taskIdsForCapture(captureId);
    for (const id of taskIds) {
      await db.update(tasks).set({ isKey: true }).where(eq(tasks.id, id));
    }
    await answerCallbackQuery(cb.id, taskIds.length > 0 ? "Marked key" : "No task from this capture");
    return;
  }

  await answerCallbackQuery(cb.id);
}

async function processUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }
  if (update.message) {
    await handleMessage(update.message, update.update_id);
  }
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  return aBuf.length === bBuf.length && timingSafeEqual(aBuf, bBuf);
}

export async function POST(req: NextRequest): Promise<Response> {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const providedSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expectedSecret || !providedSecret || !timingSafeStringEqual(providedSecret, expectedSecret)) {
    return new Response("unauthorized", { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) return new Response("ok", { status: 200 });

  const fromId = update.message?.from?.id ?? update.callback_query?.from?.id;
  const expectedUserId = process.env.TELEGRAM_USER_ID;
  if (!expectedUserId || String(fromId) !== expectedUserId) {
    // Do not leak whether this bot is configured/who it belongs to.
    return new Response("ok", { status: 200 });
  }

  // Return 200 now; Telegram redelivers if this doesn't come back within a
  // few seconds (§3.4). Everything else runs after the response is sent.
  after(async () => {
    try {
      await processUpdate(update);
    } catch (err) {
      console.error("telegram webhook: processUpdate failed", err);
    }
  });

  return new Response("ok", { status: 200 });
}
