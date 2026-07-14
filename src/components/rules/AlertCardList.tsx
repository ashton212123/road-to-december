"use client";

import { useEffect, useState } from "react";
import { AlertCard } from "@/components/ui/AlertCard";
import type { RuleAlert } from "@/lib/rules/engine";

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
    setDismissed(loadDismissed());
  }, []);

  const visible = alerts.filter((a) => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {visible.map((alert) => (
        <AlertCard
          key={alert.id}
          tone={alert.tone}
          title={alert.title}
          body={alert.body}
          onDismiss={() => {
            const next = new Set(dismissed);
            next.add(alert.id);
            setDismissed(next);
            saveDismissed(next);
          }}
        />
      ))}
    </div>
  );
}
