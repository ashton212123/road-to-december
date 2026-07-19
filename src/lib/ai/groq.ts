/**
 * Shared low-level Groq chat-completion client. Every AI feature in the app
 * (macro estimation, the daily brief, the coach chat) calls through here so
 * there's one place that owns the endpoint, model, auth, and timeout. Never
 * throws -- callers get `null` on a missing key, network error, or bad
 * response and are expected to have a non-AI fallback or a plain "brief
 * unavailable" state.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

export async function callGroqChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { jsonMode?: boolean; temperature?: number; timeoutMs?: number } = {}
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: opts.temperature ?? 0.4,
        ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
        messages,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

/** Streams a chat completion as plain text chunks (already unwrapped from Groq's SSE/delta framing). Returns null immediately if the key is missing or the initial request fails; a mid-stream failure just ends the stream early. */
export async function streamGroqChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { temperature?: number } = {}
): Promise<ReadableStream<string> | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  let res: Response;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: opts.temperature ?? 0.5,
        stream: true,
        messages,
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    return null;
  }
  if (!res.ok || !res.body) return null;

  const upstream = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream<string>({
    async pull(controller) {
      const { done, value } = await upstream.read();
      if (done) {
        controller.close();
        return;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          controller.close();
          return;
        }
        try {
          const parsed = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) controller.enqueue(delta);
        } catch {
          // ignore malformed SSE chunks
        }
      }
    },
    cancel() {
      upstream.cancel();
    },
  });
}
