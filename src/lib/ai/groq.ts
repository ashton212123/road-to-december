/**
 * Shared low-level Groq chat-completion client. Every AI feature in the app
 * (macro estimation, the daily brief, the coach chat) calls through here so
 * there's one place that owns the endpoint, model, auth, and timeout. Never
 * throws -- callers get a discriminated GroqChatResult instead, and are
 * expected to have a non-AI fallback or a plain "unavailable" state. Every
 * failure is logged here (once, centrally) so callers aren't required to
 * inspect `error` themselves just to get a diagnosable log line.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "llama-3.3-70b-versatile";

// WS4 §4d Task 2: Groq's 429 body text names which limit was hit ("... on
// tokens per minute (TPM): ..." vs "... on tokens per day (TPD): ..."). TPD
// cannot be fixed by inter-call pacing -- distinguishing it from TPM here is
// the whole point (see analyst.ts's ANALYST_SEED comment history for why
// this was previously indistinguishable and cost real debugging time).
export type GroqChatError =
  | { kind: "missing_key" }
  | { kind: "rate_limited"; scope: "tpm" | "tpd" | "unknown"; status: number; body: string }
  | { kind: "http_error"; status: number; body: string }
  | { kind: "network_error"; message: string }
  | { kind: "parse_error"; body: string };

export type GroqChatResult = { ok: true; content: string } | { ok: false; error: GroqChatError };

function classifyRateLimitScope(body: string): "tpm" | "tpd" | "unknown" {
  if (/tokens per day \(TPD\)/i.test(body)) return "tpd";
  if (/tokens per minute \(TPM\)/i.test(body)) return "tpm";
  return "unknown";
}

function logGroqError(source: string, error: GroqChatError): void {
  console.error(`[groq:${source}]`, error);
}

export async function callGroqChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { jsonMode?: boolean; temperature?: number; timeoutMs?: number; seed?: number } = {}
): Promise<GroqChatResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const error: GroqChatError = { kind: "missing_key" };
    logGroqError("callGroqChat", error);
    return { ok: false, error };
  }

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
        temperature: opts.temperature ?? 0.4,
        ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
        ...(opts.seed !== undefined ? { seed: opts.seed } : {}),
        messages,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
  } catch (err) {
    const error: GroqChatError = { kind: "network_error", message: err instanceof Error ? err.message : String(err) };
    logGroqError("callGroqChat", error);
    return { ok: false, error };
  }

  // Read as text first (not res.json()) so a malformed body still leaves
  // something to log and classify, instead of throwing the raw text away.
  const bodyText = await res.text().catch(() => "");

  if (!res.ok) {
    const error: GroqChatError =
      res.status === 429
        ? { kind: "rate_limited", scope: classifyRateLimitScope(bodyText), status: res.status, body: bodyText }
        : { kind: "http_error", status: res.status, body: bodyText };
    logGroqError("callGroqChat", error);
    return { ok: false, error };
  }

  try {
    const data = JSON.parse(bodyText) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      const error: GroqChatError = { kind: "parse_error", body: bodyText };
      logGroqError("callGroqChat", error);
      return { ok: false, error };
    }
    return { ok: true, content };
  } catch {
    const error: GroqChatError = { kind: "parse_error", body: bodyText };
    logGroqError("callGroqChat", error);
    return { ok: false, error };
  }
}

/** Whisper transcription (whisper-large-v3-turbo). The multipart filename
 * must carry the audio's real extension/content-type or Groq silently
 * returns an empty transcript -- the same gotcha the Telegram webhook's own
 * voice-note handler documents (api/telegram/webhook/route.ts); callers must
 * pass the actual recorded mimeType/filename, never a guessed default.
 * Never throws -- callers get a discriminated result instead, same contract
 * and same GroqChatError shape as callGroqChat, since this is the priority
 * fix (WS5 §0 Task 3D): silent voice-logging failure was previously
 * indistinguishable from "no speech in the recording." */
export async function transcribeAudio(audio: Blob, filename: string): Promise<GroqChatResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const error: GroqChatError = { kind: "missing_key" };
    logGroqError("transcribeAudio", error);
    return { ok: false, error };
  }

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", "whisper-large-v3-turbo");

  let res: Response;
  try {
    res = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    const error: GroqChatError = { kind: "network_error", message: err instanceof Error ? err.message : String(err) };
    logGroqError("transcribeAudio", error);
    return { ok: false, error };
  }

  const bodyText = await res.text().catch(() => "");

  if (!res.ok) {
    const error: GroqChatError =
      res.status === 429
        ? { kind: "rate_limited", scope: classifyRateLimitScope(bodyText), status: res.status, body: bodyText }
        : { kind: "http_error", status: res.status, body: bodyText };
    logGroqError("transcribeAudio", error);
    return { ok: false, error };
  }

  try {
    const data = JSON.parse(bodyText) as { text?: string };
    if (typeof data.text !== "string") {
      const error: GroqChatError = { kind: "parse_error", body: bodyText };
      logGroqError("transcribeAudio", error);
      return { ok: false, error };
    }
    return { ok: true, content: data.text };
  } catch {
    const error: GroqChatError = { kind: "parse_error", body: bodyText };
    logGroqError("transcribeAudio", error);
    return { ok: false, error };
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

/** WS5 §0 Task 3D: same "no failure mode indistinguishable from no result"
 * requirement as callGroqChat, applied without changing this function's
 * external `string | null` shape -- route.ts already treats null as "fall
 * back to the plain streaming path," and restructuring a multi-round tool
 * loop's return type would ripple into that fallback logic for no real
 * benefit. Every path that returns null now logs a reason first. */
function logToolsError(reason: string, detail: unknown): void {
  console.error("[groq:callGroqChatWithTools]", reason, detail);
}

/** Groq function-calling loop (same OpenAI-compatible shape the endpoint
 * already speaks for jsonMode). Executes any tool_calls the model requests
 * via `executeTool`, feeds results back, and repeats until the model
 * answers in plain text, MAX_TOOL_ROUNDS is hit, or the shared deadline
 * runs out -- then forces a final no-tools call (if there's still time) so
 * the athlete gets a real answer instead of a silent stop. Never throws --
 * null on missing key/network failure/deadline exhaustion, same contract
 * as the rest of this file (route.ts falls back to the plain streaming
 * path when this returns null) -- but every one of those null returns is
 * now logged with its distinguishing reason first (see logToolsError). */
export async function callGroqChatWithTools(
  messages: GroqMessage[],
  tools: GroqToolDef[],
  executeTool: (name: string, args: Record<string, unknown>) => Promise<string>,
  opts: { temperature?: number } = {}
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logToolsError("missing_key", null);
    return null;
  }

  const conversation = [...messages];
  const deadline = Date.now() + TOOL_LOOP_DEADLINE_MS;
  const timeLeft = () => Math.max(0, deadline - Date.now());

  async function callOnce(toolChoice: "auto" | "none", timeoutMs: number): Promise<{ message: GroqMessage } | null> {
    let settled = false;
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
        if (!res.ok) {
          logToolsError("http_error", { status: res.status, body: await res.text().catch(() => "") });
          return null;
        }
        const data = (await res.json()) as { choices?: { message?: GroqMessage }[] };
        const message = data.choices?.[0]?.message;
        if (!message) {
          logToolsError("parse_error", "no message in response");
          return null;
        }
        return { message };
      } catch (err) {
        logToolsError("network_error", err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        settled = true;
      }
    })();
    const result = await raceTimeout(attempt, timeoutMs, null);
    // If the race resolved via its timeout fallback before `attempt` itself
    // settled, `attempt`'s own catch/return branches above never ran, so
    // this is the one null-path they can't have already logged.
    if (result === null && !settled) logToolsError("timeout", { timeoutMs });
    return result;
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (timeLeft() < MIN_STEP_TIMEOUT_MS) break;
    const result = await callOnce("auto", timeLeft());
    if (!result) return null; // already logged inside callOnce
    const { message } = result;

    if (!message.tool_calls || message.tool_calls.length === 0) {
      if (message.content === null || message.content === undefined) {
        logToolsError("empty_content_no_tool_calls", null);
        return null;
      }
      return message.content;
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
  if (timeLeft() < MIN_STEP_TIMEOUT_MS) {
    logToolsError("deadline_exhausted", null);
    return null;
  }
  const final = await callOnce("none", timeLeft());
  if (!final) return null; // already logged inside callOnce
  if (final.message.content === null || final.message.content === undefined) {
    logToolsError("empty_final_content", null);
    return null;
  }
  return final.message.content;
}

/** Streams a chat completion as plain text chunks (already unwrapped from Groq's SSE/delta framing).
 * Returns null immediately if the key is missing or the initial request fails -- every one of those
 * pre-stream failures is now logged with its distinguishing reason (same GroqChatError classification
 * as callGroqChat), so a null here is never indistinguishable from "no result" in the server log, even
 * though the return type itself stays a plain stream-or-null (wrapping the stream in a result object
 * would just push the same ok/err check onto every caller for no benefit -- the caller already treats
 * null as "unavailable, fall back"). A mid-stream failure still just ends the stream early -- that's a
 * partial-result case, not a "no result" one, so it's unchanged. */
export async function streamGroqChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { temperature?: number } = {}
): Promise<ReadableStream<string> | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    logGroqError("streamGroqChat", { kind: "missing_key" });
    return null;
  }

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
  } catch (err) {
    logGroqError("streamGroqChat", { kind: "network_error", message: err instanceof Error ? err.message : String(err) });
    return null;
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    logGroqError(
      "streamGroqChat",
      res.status === 429
        ? { kind: "rate_limited", scope: classifyRateLimitScope(bodyText), status: res.status, body: bodyText }
        : { kind: "http_error", status: res.status, body: bodyText }
    );
    return null;
  }
  if (!res.body) {
    logGroqError("streamGroqChat", { kind: "parse_error", body: "response had no body" });
    return null;
  }

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
