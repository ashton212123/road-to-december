"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CoachChat } from "./CoachChat";
import { IconSparkle } from "@/components/ui/icons";
import { quickPromptsForPath } from "@/lib/coach/quickPrompts";

export const OPEN_COACH_EVENT = "rtd:open-coach";

/** Persistent floating coach button + slide-over panel, rendered once at
 * the app layout level so it's available on every desktop page. Reuses the
 * same /api/coach/chat backend and context assembly as the full /more/
 * coach-ai page -- this is a quick-access surface, not a separate brain. */
export function CoachPanel() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open coach"
        className="hidden md:flex fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full items-center justify-center cursor-pointer text-[var(--rtd-purple)] hover:brightness-110 active:scale-95 transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
        style={{
          background: "rgba(28,28,30,0.72)",
          border: "0.5px solid var(--rtd-hairline)",
          boxShadow: "0 0 24px rgba(191,90,242,0.25), var(--rtd-shadow)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <IconSparkle />
      </button>

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
            <div className="flex items-center justify-between mb-2 shrink-0">
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
              <CoachChat initialMessages={[]} quickPrompts={quickPromptsForPath(pathname ?? "/")} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
