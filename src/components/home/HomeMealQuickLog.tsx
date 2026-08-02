"use client";

import { useState, useTransition } from "react";
import { estimateMealAction, logMealBatchAction, type MealReviewItem } from "@/app/(app)/fuel/actions";

/** Compact inline sibling of MealQuickLog (§4e/WS5 §0 Task 4E) -- same two
 * server actions, no separate AI wiring. Lives outside FuelRingCard's
 * href="/fuel" Link (the card's tap-through target) so its own clicks don't
 * bubble into that navigation; stopPropagation on the wrapper is the guard
 * for that, not a defense against anything else. */
export function HomeMealQuickLog() {
  const [text, setText] = useState("");
  const [items, setItems] = useState<MealReviewItem[] | null>(null);
  const [estimating, startEstimate] = useTransition();
  const [saving, startSave] = useTransition();

  function estimate() {
    if (!text.trim()) return;
    startEstimate(async () => {
      const result = await estimateMealAction(text);
      setItems(result.items);
    });
  }

  function confirm() {
    if (!items || items.length === 0) return;
    startSave(async () => {
      await logMealBatchAction(
        items.map((it) => ({
          timeSlot: it.timeSlot,
          description: it.name || "Unnamed item",
          kcal: it.kcal,
          proteinG: it.proteinG,
          carbsG: it.carbsG,
          fatG: it.fatG,
          source: it.source,
        }))
      );
      setItems(null);
      setText("");
    });
  }

  return (
    <div className="flex flex-col gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
      {!items ? (
        <div className="flex items-center gap-1.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") estimate();
            }}
            placeholder='Log a meal — try "estimate 500 cals"'
            className="flex-1 min-w-0 rounded-full bg-white/[0.06] px-3 py-1.5 text-caption text-[var(--rtd-text)] placeholder:text-[var(--rtd-text-tertiary)] outline-none"
          />
          <button
            type="button"
            disabled={estimating || !text.trim()}
            onClick={estimate}
            className="rtd-tap-target shrink-0 text-caption font-semibold px-3 py-1.5 rounded-full bg-white/[0.08] text-[var(--rtd-text)] disabled:opacity-40 cursor-pointer hover:brightness-110 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            {estimating ? <span className="rtd-pulse">…</span> : "Go"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 rtd-fade-in">
          {items.length === 0 ? (
            <span className="text-caption text-[var(--rtd-text-tertiary)]">Nothing parsed — try rephrasing.</span>
          ) : (
            items.map((it, i) => (
              <div key={i} className="flex items-center gap-2 text-caption">
                <span className="flex-1 min-w-0 truncate text-[var(--rtd-text)]">{it.name}</span>
                <span className="rtd-nums rtd-mono text-[var(--rtd-text-secondary)] shrink-0">{Math.round(it.kcal)} kcal</span>
              </div>
            ))
          )}
          <div className="flex gap-1.5">
            {items.length > 0 && (
              <button
                type="button"
                disabled={saving}
                onClick={confirm}
                className="rtd-tap-target flex-1 text-caption font-semibold px-3 py-1.5 rounded-full bg-white/[0.08] text-[var(--rtd-text)] disabled:opacity-40 cursor-pointer hover:brightness-110 active:scale-[0.98] transition-transform duration-150 ease-out"
              >
                {saving ? <span className="rtd-pulse">Logging…</span> : `Log ${items.length} item${items.length === 1 ? "" : "s"}`}
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setItems(null);
                setText("");
              }}
              className="rtd-tap-target flex-1 text-caption text-[var(--rtd-text-secondary)] px-3 py-1.5 rounded-full bg-white/[0.04] disabled:opacity-40 cursor-pointer hover:brightness-110 active:scale-[0.98] transition-transform duration-150 ease-out"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
