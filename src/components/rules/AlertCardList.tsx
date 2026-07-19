"use client";

import { useEffect, useState } from "react";
import type { AlertTone } from "@/components/ui/AlertCard";
import type { RuleAlert } from "@/lib/rules/engine";

const TONE_COLOR: Record<AlertTone, string> = {
  info: "var(--rtd-blue)",
  warning: "var(--rtd-orange)",
  danger: "var(--rtd-red)",
  success: "var(--rtd-green)",
};

const TONE_ICON: Record<AlertTone, string> = {
  info: "ℹ",
  warning: "⚠",
  danger: "⚠",
  success: "✓",
};

const STORAGE_KEY = "rtd-dismissed-alerts";

function todayKeyForStorage() {
  return new Date().toISOString().slice(0, 10);
}

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { date: string; ids: string[] };
    if (parsed.date !== todayKeyForStorage()) return new Set();
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

function saveDismissed(ids: Set<string>) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ date: todayKeyForStorage(), ids: [...ids] })
  );
}

export function AlertCardList({ alerts }: { alerts: RuleAlert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Reads localStorage after mount (not during render) so the client's
    // first paint matches the server's, avoiding a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(loadDismissed());
  }, []);

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rtd-fade-in">
      {visible.map((alert) => {
        const color = TONE_COLOR[alert.tone];
        return (
          <div
            key={alert.id}
            className="rtd-strip"
            style={{ backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)` }}
          >
            <span aria-hidden="true" style={{ color }} className="shrink-0">
              {TONE_ICON[alert.tone]}
            </span>
            <span className="flex-1 min-w-0 truncate text-[var(--rtd-text)]">
              <span className="font-semibold">{alert.title}</span>
              {alert.body && <span className="text-[var(--rtd-text-secondary)]"> — {alert.body}</span>}
            </span>
            <button
              onClick={() => {
                const next = new Set(dismissed);
                next.add(alert.id);
                setDismissed(next);
                saveDismissed(next);
              }}
              aria-label="Dismiss"
              className="rtd-tap-target shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-[var(--rtd-text-tertiary)] cursor-pointer hover:bg-white/10 hover:text-[var(--rtd-text)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
