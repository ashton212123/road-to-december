"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";

type Block = { id: string; title: string; body: string };

export function TaperChecklist({ blocks }: { blocks: Block[] }) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const storageKey = "rtd-taper-checklist";

  useEffect(() => {
    // Reads localStorage after mount (not during render) so the client's
    // first paint matches the server's, avoiding a hydration mismatch.
    try {
      const raw = window.localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setChecked(JSON.parse(raw));
    } catch {
      // ignore corrupt local state
    }
  }, []);

  function toggle(id: string, line: number) {
    const key = `${id}:${line}`;
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      window.localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block) => (
        <GlassCard key={block.id} className="flex flex-col gap-2">
          <div className="text-sm font-semibold">{block.title}</div>
          {block.body.split("\n\n").map((line, i) => {
            const key = `${block.id}:${i}`;
            const isChecked = checked[key] ?? false;
            return (
              <button
                key={key}
                onClick={() => toggle(block.id, i)}
                className="flex items-start gap-2.5 text-left"
              >
                <span
                  className="w-4 h-4 rounded-md border shrink-0 mt-0.5 flex items-center justify-center text-[10px]"
                  style={{
                    borderColor: isChecked ? "var(--rtd-green)" : "var(--rtd-hairline)",
                    background: isChecked ? "var(--rtd-green)" : "transparent",
                  }}
                >
                  {isChecked && "✓"}
                </span>
                <span
                  className="text-xs leading-snug"
                  style={{
                    color: isChecked ? "var(--rtd-text-tertiary)" : "var(--rtd-text-secondary)",
                    textDecoration: isChecked ? "line-through" : "none",
                  }}
                >
                  {line}
                </span>
              </button>
            );
          })}
        </GlassCard>
      ))}
    </div>
  );
}
