/**
 * Shared low-level Groq chat-completion client. Every AI feature in the app
 * (macro estimation, the daily brief, the coach chat) calls through here so
 * there's one place that owns the endpoint, model, auth, and timeout. Never
 * throws -- callers get `null` on a missing key, network error, or bad
 * response and are expected to have a non-AI fallback or a plain "brief
 * unavailable" state.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "llama-3.3-70b-versatile";

export async function callGroqChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { jsonMode?: boolean; temperature?: number; timeoutMs?: number; seed?: number } = {}
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
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
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

/** Whisper transcription (whisper-large-v3-turbo). The multipart filename
 * must carry the audio's real extension/content-type or Groq silently
 * returns an empty transcript -- the same gotcha the Telegram webhook's own
 * voice-note handler documents (api/telegram/webhook/route.ts); callers must
 * pass the actual recorded mimeType/filename, never a guessed default.
 * Never throws -- null on missing key, network error, or bad response. */
export async function transcribeAudio(audio: Blob, filename: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-large-v3-turbo");

  try {
    const res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    return typeof data.text === "string" ? data.text : null;
  } catch {
    return null;
  }
}

export type GroqToolDef = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};
type GroqToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
type GroqMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
};

const MAX_TOOL_ROUNDS = 4;
// Route's maxDuration is 60s and the context fetch before this loop starts
// already spends some of that -- 40s leaves real headroom. Deliberately a
// wall-clock deadline shared across every round/tool-call rather than a
// fixed per-call timeout: AbortSignal passed to fetch() isn't guaranteed to
// cancel an in-flight res.json() body read on every runtime (a real gotcha
// that cost real debugging time here), so this bound doesn't depend on that
// -- a plain setTimeout race can't get stuck no matter what the network is
// doing underneath it.
const TOOL_LOOP_DEADLINE_MS = 40_000;
const MIN_STEP_TIMEOUT_MS = 3_000;

/** Resolves to `fallback` if `promise` hasn't settled by `ms` -- unlike an
 * AbortSignal-based timeout, this doesn't rely on the underlying operation
 * cooperating with cancellation, so it's a hard ceiling on wall-clock time
 * regardless of what's actually slow underneath. */
function raceTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      }
    );
  });
}

/** Groq function-calling loop (same OpenAI-compatible shape the endpoint
 * already speaks for jsonMode). Executes any tool_calls the model requests
 * via `executeTool`, feeds results back, and repeats until the model
 * answers in plain text, MAX_TOOL_ROUNDS is hit, or the shared deadline
 * runs out -- then forces a final no-tools call (if there's still time) so
 * the athlete gets a real answer instead of a silent stop. Never throws --
 * null on missing key/network failure/deadline exhaustion, same contract
 * as the rest of this file (route.ts falls back to the plain streaming
 * path when this returns null). */
export async function callGroqChatWithTools(
  messages: GroqMessage[],
  tools: GroqToolDef[],
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>,
  opts: { temperature?: number } = {}
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const conversation = [...messages];
  const deadline = Date.now() + TOOL_LOOP_DEADLINE_MS;
  const timeLeft = () => Math.max(0, deadline - Date.now());

  async function callOnce(toolChoice: "auto" | "none", timeoutMs: number): Promise<{ message: GroqMessage } | null> {
    const attempt = (async (): Promise<{ message: GroqMessage } | null> => {
      try {
        const res = await fetch(GROQ_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: MODEL,
            temperature: opts.temperature ?? 0.4,
            messages: conversation,
            ...(toolChoice === "auto" ? { tools, tool_choice: "auto" } : { tool_choice: "none" }),
          }),
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { choices?: { message?: GroqMessage }[] };
        const message = data.choices?.[0]?.message;
        return message ? { message } : null;
      } catch {
        return null;
      }
    })();
    return raceTimeout(attempt, timeoutMs, null);
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (timeLeft() < MIN_STEP_TIMEOUT_MS) break;
    const result = await callOnce("auto", timeLeft());
    if (!result) return null;
    const { message } = result;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      return message.content ?? null;
    }

    conversation.push(message);
    for (const call of message.tool_calls) {
      if (timeLeft() < MIN_STEP_TIMEOUT_MS) {
        conversation.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "timed out before this could run" }) });
        continue;
      }
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // malformed arguments -- let the executor's tool report the failure back to the model
      }
      const output = await raceTimeout(
        executeTool(call.function.name, args).catch((err) => JSON.stringify({ error: err instanceof Error ? err.message : "tool failed" })),
        timeLeft(),
        JSON.stringify({ error: "timed out" })
      );
      conversation.push({ role: "tool", tool_call_id: call.id, content: output });
    }
  }

  // Ran out of rounds (or deadline) -- force a final plain-text answer if
  // there's still time, instead of silently stopping mid tool-call.
  if (timeLeft() < MIN_STEP_TIMEOUT_MS) return null;
  const final = await callOnce("none", timeLeft());
  return final?.message.content ?? null;
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
