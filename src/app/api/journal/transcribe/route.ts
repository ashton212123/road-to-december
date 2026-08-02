import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { journalEntries } from "@/lib/db/schema";
import { todayManilaISO } from "@/lib/time";
import { transcribeAudio, callGroqChat } from "@/lib/ai/groq";
import { rememberChunk } from "@/lib/memory/write";

// Whisper + the Groq summary call both need real time on a cold path -- same
// headroom as api/capture's own maxDuration for the same reason.
export const maxDuration = 60;

function extensionForMimeType(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return "mp3";
  return "webm";
}

/**
 * Accepts either a recorded `audio` blob, typed `text`, or both (a failed
 * transcription still leaves the user's typed fallback to save, per §Gate).
 * Auth is proxy.ts's ordinary session-cookie gate -- this path isn't in
 * PUBLIC_PATHS, so only a logged-in browser session reaches here.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return Response.json({ error: "expected multipart form data" }, { status: 400 });
  }

  const audio = form.get("audio");
  const typedText = form.get("text");

  let transcript: string | null = null;
  if (audio instanceof Blob && audio.size > 0) {
    const filename = audio instanceof File && audio.name ? audio.name : `recording.${extensionForMimeType(audio.type)}`;
    const transcribeResult = await transcribeAudio(audio, filename);
    transcript = transcribeResult.ok ? transcribeResult.content : null;
  }

  const rawText = typeof typedText === "string" && typedText.trim() ? typedText.trim() : null;
  const textForSummary = transcript?.trim() || rawText;

  if (!textForSummary) {
    return Response.json(
      { error: "No audio or text provided, and transcription returned nothing -- try typing it instead." },
      { status: 400 }
    );
  }

  const summaryResult = await callGroqChat(
    [
      {
        role: "system",
        content:
          "Summarize this journal entry in 3-5 sentences. Second person ('you'), factual, no therapy voice, no advice or reflection -- just what happened, plainly.",
      },
      { role: "user", content: textForSummary },
    ],
    { temperature: 0.3 }
  );
  const summary = summaryResult.ok ? summaryResult.content : null;

  const entryDate = todayManilaISO();
  const [entry] = await db
    .insert(journalEntries)
    .values({ entryDate, rawText, transcript, summary, source: "web" })
    .returning();

  await rememberChunk({
    sourceType: "journal",
    sourceId: String(entry.id),
    sourceDate: entryDate,
    text: textForSummary,
    metadata: { source: "web" },
  }).catch((err) => console.error(`/api/journal/transcribe: rememberChunk failed for entry ${entry.id}`, err));

  revalidatePath("/life/journal");

  return Response.json({ entry });
}
