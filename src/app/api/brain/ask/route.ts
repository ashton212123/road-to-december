import type { NextRequest } from "next/server";
import { searchMemory } from "@/lib/memory/search";
import { callGroqChat } from "@/lib/ai/groq";

// Exact system prompt from §6c -- verbatim, not paraphrased.
const SYSTEM_PROMPT =
  "You are Ashton's personal operating system. Answer using ONLY the provided context. Cite sources " +
  "inline by their [type:id] tag. If the context does not contain the answer, say so plainly -- do " +
  "not guess about training data.";

// ~4 chars/token is a rough, tokenizer-free heuristic (this app has no
// tokenizer dependency anywhere) -- 800 chars keeps each of the top 20
// chunks around the ~200-token budget §6c asks for without an exact count.
const CHARS_PER_CHUNK = 800;

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { question?: string } | null;
  const question = body?.question?.trim();
  if (!question) {
    return Response.json({ error: "question is required" }, { status: 400 });
  }

  const chunks = await searchMemory(question, 20);
  const context = chunks
    .map((c) => `[${c.sourceType}:${c.sourceId}]${c.sourceDate ? ` (${c.sourceDate})` : ""} ${truncate(c.text, CHARS_PER_CHUNK)}`)
    .join("\n");

  const answer = await callGroqChat(
    [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Context:\n${context || "(no matching context found in the database)"}\n\nQuestion: ${question}`,
      },
    ],
    { temperature: 0.2 }
  );

  return Response.json({
    answer: answer ?? "The Brain is unavailable right now (AI service error) -- try again shortly.",
    sources: chunks.map((c) => ({ type: c.sourceType, id: c.sourceId, date: c.sourceDate })),
  });
}
