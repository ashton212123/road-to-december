"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function CoachChat({
  initialMessages,
  quickPrompts,
  autoSend,
}: {
  initialMessages: ChatMessage[];
  quickPrompts: string[];
  autoSend?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  // 1->4 rows, growing with content -- multi-line input (a whole swim
  // session pasted in) used to stay cramped in a single fixed row.
  const MAX_TEXTAREA_HEIGHT = 112;
  function resizeTextarea(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Reset the grown height back to one row once a send clears the input --
  // resizeTextarea only runs from the onChange DOM event, which doesn't
  // fire for a programmatic setInput("").
  useEffect(() => {
    if (input === "" && textareaRef.current) textareaRef.current.style.height = "auto";
  }, [input]);

  // Deep-links (e.g. from Learn's "ask coach" button) land here with a
  // pre-filled question via ?q= -- send it once on arrival instead of
  // making the user retype and hit send themselves.
  useEffect(() => {
    if (!autoSend || autoSentRef.current) return;
    autoSentRef.current = true;
    send(autoSend);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);

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
                ? "self-end max-w-[85%] rounded-[10px] rounded-br-[4px] bg-[var(--rtd-blue)] text-white px-3.5 py-2.5 text-subhead leading-relaxed whitespace-pre-wrap"
                : "self-start max-w-[85%] rounded-[10px] rounded-bl-[4px] bg-white/[0.06] text-[var(--rtd-text)] px-3.5 py-2.5 text-subhead leading-relaxed whitespace-pre-wrap"
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
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            resizeTextarea(e.target);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask your coach…"
          aria-label="Message your coach"
          rows={1}
          style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
          className="flex-1 min-w-0 rounded-[8px] bg-white/[0.06] px-3.5 py-2.5 text-subhead outline-none resize-none focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
        />
        <Button type="submit" disabled={streaming || !input.trim()} className="shrink-0">
          Send
        </Button>
      </form>
    </div>
  );
}
