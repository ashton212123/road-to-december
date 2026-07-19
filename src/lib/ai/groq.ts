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
