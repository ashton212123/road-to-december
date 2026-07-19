"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function CoachChat({
  initialMessages,
  quickPrompts,
}: {
  initialMessages: ChatMessage[];
  quickPrompts: string[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;

    setError(null);
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/coach/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok || !res.body) {
        throw new Error(await res.text().catch(() => "The coach didn't respond."));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: next[next.length - 1].content + chunk };
          return next;
        });
      }
    } catch (err) {
      setMessages((prev) => prev.slice(0, -1));
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pb-3" aria-live="polite">
        {messages.length === 0 && (
          <div className="text-subhead text-[var(--rtd-text-tertiary)] text-center py-8">
            Ask about your training, nutrition, or meet readiness -- the coach sees today&apos;s data and your notes.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "self-end max-w-[85%] rounded-2xl rounded-br-md bg-[var(--rtd-blue)] text-white px-3.5 py-2.5 text-subhead leading-relaxed whitespace-pre-wrap"
                : "self-start max-w-[85%] rounded-2xl rounded-bl-md bg-white/[0.06] text-[var(--rtd-text)] px-3.5 py-2.5 text-subhead leading-relaxed whitespace-pre-wrap"
            }
          >
            {m.content || (streaming && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
        {error && <div className="self-start text-caption text-[var(--rtd-red)] px-3.5">{error}</div>}
      </div>

      {messages.length === 0 && quickPrompts.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {quickPrompts.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => send(p)}
              className="shrink-0 text-caption px-2.5 py-1.5 rounded-full whitespace-nowrap bg-white/[0.06] text-[var(--rtd-text-secondary)] cursor-pointer hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out rtd-tap-target"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 pt-1"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask your coach…"
          aria-label="Message your coach"
          rows={1}
          className="flex-1 min-w-0 rounded-2xl bg-white/[0.06] px-3.5 py-2.5 text-subhead outline-none resize-none focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
        />
        <Button type="submit" disabled={streaming || !input.trim()} className="shrink-0">
          Send
        </Button>
      </form>
    </div>
  );
}
