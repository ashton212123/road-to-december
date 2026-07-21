"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { CoachChat } from "./CoachChat";
import { IconSparkle } from "@/components/ui/icons";
import { quickPromptsForPath } from "@/lib/coach/quickPrompts";
import { useKeyboardOpen } from "@/lib/useKeyboardOpen";

export const OPEN_COACH_EVENT = "rtd:open-coach";

/** Persistent floating coach button + slide-over panel, rendered once at
 * the app layout level so it's available on every desktop page. Reuses the
 * same /api/coach/chat backend and context assembly as the full /more/
 * coach-ai page -- this is a quick-access surface, not a separate brain. */
type ChatMessage = { role: "user" | "assistant"; content: string };

export function CoachPanel() {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const pathname = usePathname();
  // The full-screen coach page has its own Send button in roughly this same
  // corner -- the FAB would sit on top of it. That page IS the coach, so a
  // shortcut button to open it makes no sense there anyway.
  const onCoachPage = pathname?.startsWith("/more/coach-ai") ?? false;
  const keyboardOpen = useKeyboardOpen();

  useEffect(() => {
    function handleOpen() {
      setOpen(true);
    }
    function handleKeydown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener(OPEN_COACH_EVENT, handleOpen);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener(OPEN_COACH_EVENT, handleOpen);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  useEffect(() => {
    if (!open || historyLoaded) return;
    fetch("/api/coach/chat")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoaded(true));
  }, [open, historyLoaded]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open coach"
        className="hidden md:flex fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full items-center justify-center cursor-pointer text-[var(--rtd-purple)] hover:brightness-110 active:scale-95 transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
        style={{
          background: "rgba(0,0,0,0.5)",
          border: "1px solid var(--rtd-hairline)",
          boxShadow: "0 0 24px rgba(129,85,255,0.25), var(--rtd-shadow)",
          backdropFilter: "blur(var(--rtd-blur))",
          WebkitBackdropFilter: "blur(var(--rtd-blur))",
        }}
      >
        <IconSparkle />
      </button>

      {/* Mobile: the desktop slide-over doesn't render below md, so this
          links straight to the full-screen coach page instead of opening
          a panel that isn't there. Fixed above the bottom dock. Suppressed
          on the coach page itself -- see onCoachPage above. */}
      {!onCoachPage && !keyboardOpen && (
        <Link
          href="/more/coach-ai"
          aria-label="Open coach"
          className="md:hidden fixed right-4 z-40 w-11 h-11 rounded-full flex items-center justify-center cursor-pointer text-[var(--rtd-purple)] active:scale-95 transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 92px)",
            background: "rgba(0,0,0,0.5)",
            border: "1px solid var(--rtd-hairline)",
            boxShadow: "0 0 24px rgba(129,85,255,0.25), var(--rtd-shadow)",
            backdropFilter: "blur(var(--rtd-blur))",
            WebkitBackdropFilter: "blur(var(--rtd-blur))",
          }}
        >
          <IconSparkle />
        </Link>
      )}

      {open && (
        <div className="hidden md:block fixed inset-0 z-50">
          <div
            className="rtd-glass-blur absolute inset-0"
            style={{ background: "rgba(0,0,0,0.35)" }}
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Coach"
            className="rtd-glass-blur absolute top-0 right-0 h-full w-[400px] flex flex-col p-4 rtd-fade-in"
            style={{ backgroundColor: "rgba(20,20,22,0.85)", borderLeft: "0.5px solid var(--rtd-hairline)" }}
          >
            <div className="rtd-hero-glow flex items-center justify-between mb-2 shrink-0 px-1 py-1">
              <div className="flex items-center gap-2">
                <span className="text-[var(--rtd-purple)]">
                  <IconSparkle />
                </span>
                <span className="text-body font-semibold">Coach</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close coach panel"
                className="rtd-tap-target w-7 h-7 flex items-center justify-center rounded-full text-[var(--rtd-text-tertiary)] cursor-pointer hover:bg-white/10 hover:text-[var(--rtd-text)] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 min-h-0">
              {historyLoaded && (
                <CoachChat initialMessages={history} quickPrompts={quickPromptsForPath(pathname ?? "/")} />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
