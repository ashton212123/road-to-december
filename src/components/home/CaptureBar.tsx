"use client";

import { useState } from "react";
import { IconSparkle, IconCheck } from "@/components/ui/icons";

const ROUTE_LABELS: Record<string, string> = {
  swim_session: "Swim session",
  swim_time: "Swim time",
  gym_set: "Gym set",
  meal: "Meal",
  water: "Water",
  sleep: "Sleep",
  weigh_in: "Weigh-in",
  soreness: "Soreness",
  task: "Task",
  journal: "Journal",
  note: "Note",
  coach_memory: "Coach memory",
};

type Toast = { kind: "sending" } | { kind: "done"; routedTo: string[] } | { kind: "error"; message: string };

/**
 * Pinned above the tab bar on Home (Phase 8 later promotes this to every
 * page). Fixed + floating only on mobile -- desktop has no bottom dock to
 * float above, so it renders in-flow there instead. Positioned well above
 * both the tab bar (bottom ~12-76px) and the coach FAB (bottom ~92-136px)
 * so it can never cover either -- verified at 390px.
 */
export function CaptureBar() {
  const [value, setValue] = useState("");
  const [toast, setToast] = useState<Toast | null>(null);

  async function submit() {
    const text = value.trim();
    if (!text) return;
    setValue("");
    setToast({ kind: "sending" });

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await res.json().catch(() => null)) as { routedTo?: string[]; error?: string } | null;
      if (!res.ok || !data) {
        setToast({ kind: "error", message: data?.error ?? "Something went wrong" });
      } else {
        setToast({ kind: "done", routedTo: data.routedTo ?? [] });
      }
    } catch {
      setToast({ kind: "error", message: "Network error" });
    }
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div
      className="fixed left-3 right-3 z-30 md:static md:z-auto md:mb-2.5"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 144px)" }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rtd-glass-blur flex items-center gap-2 rounded-full px-3.5 h-12 md:h-11 border border-[var(--rtd-hairline)] focus-within:border-[var(--rtd-blue)] transition-colors duration-150 ease-out"
        style={{ background: "rgba(10,10,12,0.82)", boxShadow: "var(--rtd-shadow)" }}
      >
        <span className="text-[var(--rtd-purple)] shrink-0" aria-hidden="true">
          <IconSparkle size={18} />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Capture anything..."
          aria-label="Quick capture"
          className="flex-1 min-w-0 bg-transparent outline-none text-subhead text-[var(--rtd-text)] placeholder:text-[var(--rtd-text-tertiary)]"
        />
        {value.trim() && (
          <button
            type="submit"
            aria-label="Send"
            className="rtd-tap-target shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-[var(--rtd-blue)] cursor-pointer active:scale-95 transition-transform duration-150 ease-out"
          >
            <IconCheck size={18} />
          </button>
        )}
      </form>

      {toast && (
        <div className="rtd-glass rtd-fade-in mt-2 px-3.5 py-2 text-footnote text-[var(--rtd-text-secondary)]" role="status">
          {toast.kind === "sending" && "Capturing..."}
          {toast.kind === "done" &&
            (toast.routedTo.length > 0
              ? `Logged: ${[...new Set(toast.routedTo)].map((k) => ROUTE_LABELS[k] ?? k).join(", ")}`
              : "Saved as a note")}
          {toast.kind === "error" && `Couldn't capture: ${toast.message}`}
        </div>
      )}
    </div>
  );
}
