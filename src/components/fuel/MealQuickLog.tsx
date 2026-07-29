"use client";

import { useRef, useState, useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { Button } from "@/components/ui/Button";
import {
  estimateMealAction,
  rethinkItemAction,
  logMealBatchAction,
  type MealReviewSource,
} from "@/app/(app)/fuel/actions";

const TIME_SLOTS = ["pre_race_pace", "breakfast", "lunch", "pre_gym", "dinner", "snack", "bedtime"];

type Confidence = "high" | "medium" | "low" | null;

type ReviewItem = {
  clientId: string;
  timeSlot: string;
  name: string;
  portionDesc: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  confidence: Confidence;
  assumptions: string;
  source: MealReviewSource;
  handEdited: boolean;
  rethinking: boolean;
  showHint: boolean;
  hint: string;
  pendingOverwrite: boolean;
  rethinkError: boolean;
};

type RecentFood = {
  description: string;
  timeSlot: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

const CONFIDENCE_COLOR: Record<Exclude<Confidence, null>, string> = {
  high: "var(--rtd-green)",
  medium: "var(--rtd-orange)",
  low: "var(--rtd-red)",
};

function scaleValue(value: string, factor: number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return String(Math.round(n * factor * 10) / 10);
}

export function MealQuickLog({ recentFoods }: { recentFoods: RecentFood[] }) {
  const [text, setText] = useState("");
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [estimating, startEstimate] = useTransition();
  const [saving, startSave] = useTransition();
  const [done, setDone] = useState(false);
  const [usedAi, setUsedAi] = useState<boolean | null>(null);
  const nextId = useRef(0);
  const rethinkPending = useRef<Set<string>>(new Set());

  function newId() {
    nextId.current += 1;
    return `item-${nextId.current}`;
  }

  function estimate() {
    if (!text.trim()) return;
    setDone(false);
    startEstimate(async () => {
      const result = await estimateMealAction(text);
      setUsedAi(result.usedAi);
      setItems(
        result.items.map((it) => ({
          clientId: newId(),
          timeSlot: it.timeSlot,
          name: it.name,
          portionDesc: it.portionDesc,
          kcal: String(it.kcal),
          proteinG: String(it.proteinG),
          carbsG: String(it.carbsG),
          fatG: String(it.fatG),
          confidence: it.confidence,
          assumptions: it.assumptions,
          source: it.source,
          handEdited: false,
          rethinking: false,
          showHint: false,
          hint: "",
          pendingOverwrite: false,
          rethinkError: false,
        }))
      );
    });
  }

  function addManualItem() {
    setDone(false);
    setItems((prev) => [
      ...(prev ?? []),
      {
        clientId: newId(),
        timeSlot: "lunch",
        name: "",
        portionDesc: "",
        kcal: "",
        proteinG: "",
        carbsG: "",
        fatG: "",
        confidence: null,
        assumptions: "",
        source: "manual",
        handEdited: false,
        rethinking: false,
        showHint: false,
        hint: "",
        pendingOverwrite: false,
        rethinkError: false,
      },
    ]);
  }

  function addRecentFood(food: RecentFood) {
    setDone(false);
    setItems((prev) => [
      ...(prev ?? []),
      {
        clientId: newId(),
        timeSlot: food.timeSlot,
        name: food.description,
        portionDesc: "",
        kcal: String(food.kcal),
        proteinG: String(food.proteinG),
        carbsG: String(food.carbsG),
        fatG: String(food.fatG),
        confidence: null,
        assumptions: "Reused from a recent log.",
        source: "manual",
        handEdited: false,
        rethinking: false,
        showHint: false,
        hint: "",
        pendingOverwrite: false,
        rethinkError: false,
      },
    ]);
  }

  function updateItem(id: string, patch: Partial<ReviewItem>) {
    setItems((prev) => (prev ? prev.map((r) => (r.clientId === id ? { ...r, ...patch } : r)) : prev));
  }

  function editMacro(id: string, field: "kcal" | "proteinG" | "carbsG" | "fatG", value: string) {
    updateItem(id, { [field]: value, handEdited: true, rethinkError: false } as Partial<ReviewItem>);
  }

  function scalePortion(id: string, factor: number) {
    setItems((prev) =>
      prev
        ? prev.map((r) =>
            r.clientId === id
              ? {
                  ...r,
                  kcal: scaleValue(r.kcal, factor),
                  proteinG: scaleValue(r.proteinG, factor),
                  carbsG: scaleValue(r.carbsG, factor),
                  fatG: scaleValue(r.fatG, factor),
                }
              : r
          )
        : prev
    );
  }

  function removeItem(id: string) {
    setItems((prev) => (prev ? prev.filter((r) => r.clientId !== id) : prev));
  }

  function toggleHint(id: string) {
    updateItem(id, { showHint: true });
  }

  function rethink(id: string) {
    const item = items?.find((r) => r.clientId === id);
    if (!item || rethinkPending.current.has(id)) return;

    if (item.handEdited && !item.pendingOverwrite) {
      updateItem(id, { pendingOverwrite: true });
      return;
    }

    rethinkPending.current.add(id);
    updateItem(id, { rethinking: true, rethinkError: false });
    startEstimate(async () => {
      const result = await rethinkItemAction(item.name, item.portionDesc, item.hint);
      rethinkPending.current.delete(id);
      if (!result) {
        updateItem(id, { rethinking: false, rethinkError: true });
        return;
      }
      updateItem(id, {
        rethinking: false,
        portionDesc: result.portionDesc,
        kcal: String(result.kcal),
        proteinG: String(result.proteinG),
        carbsG: String(result.carbsG),
        fatG: String(result.fatG),
        confidence: result.confidence,
        assumptions: result.assumptions,
        source: "ai",
        handEdited: false,
        showHint: false,
        hint: "",
        pendingOverwrite: false,
      });
    });
  }

  function confirmLog() {
    if (!items || items.length === 0) return;
    startSave(async () => {
      await logMealBatchAction(
        items.map((r) => ({
          timeSlot: r.timeSlot,
          description: r.name || "Unnamed item",
          kcal: Number(r.kcal) || 0,
          proteinG: Number(r.proteinG) || 0,
          carbsG: r.carbsG ? Number(r.carbsG) : undefined,
          fatG: r.fatG ? Number(r.fatG) : undefined,
          source: r.source,
        }))
      );
      setItems(null);
      setText("");
      setUsedAi(null);
      setDone(true);
    });
  }

  return (
    <TerminalPanel fill={false}>
      <div className="text-title-3">Quick log — describe your day</div>

      {!items && (
        <>
          {recentFoods.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {recentFoods.slice(0, 6).map((food, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => addRecentFood(food)}
                  className="shrink-0 text-caption px-2.5 py-1.5 rounded-full whitespace-nowrap bg-white/[0.06] text-[var(--rtd-text-secondary)] cursor-pointer hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out rtd-tap-target"
                  title={`${food.kcal} kcal · ${food.proteinG}g protein`}
                >
                  {food.description.length > 22 ? `${food.description.slice(0, 22)}…` : food.description}
                </button>
              ))}
            </div>
          )}
          <textarea
            placeholder='e.g. "lunch: chicken rice, creatine, dinner adobo"'
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="rounded-[8px] bg-white/[0.06] px-3 py-2 outline-none resize-none"
          />
          <Button variant="primary" disabled={estimating || !text.trim()} onClick={estimate}>
            {estimating ? (
              <span className="rtd-pulse">Thinking…</span>
            ) : done ? (
              "Logged ✓ — estimate another"
            ) : (
              "Estimate"
            )}
          </Button>
          <button
            type="button"
            onClick={addManualItem}
            className="rtd-tap-target text-footnote text-[var(--rtd-text-secondary)] cursor-pointer hover:text-[var(--rtd-text)] transition-colors duration-150 ease-out self-start"
          >
            + Add item manually
          </button>
          <div className="text-caption text-[var(--rtd-text-tertiary)]">
            AI estimates macros from what you describe — review and edit before saving, nothing logs automatically.
          </div>
        </>
      )}

      {items && (
        <div className="flex flex-col gap-3 rtd-fade-in" aria-live="polite">
          {items.length === 0 && (
            <div className="text-footnote text-[var(--rtd-text-secondary)]">Nothing parsed — try rephrasing.</div>
          )}
          {usedAi === false && items.length > 0 && (
            <div className="text-caption text-[var(--rtd-orange)]">
              AI estimation unavailable — matched against USDA data instead. Numbers may be less precise.
            </div>
          )}

          {items.map((row) => (
            <div key={row.clientId} className="flex flex-col gap-2 bg-white/[0.04] rounded-[10px] p-2.5">
              <div className="flex items-center gap-2">
                {row.confidence && (
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: CONFIDENCE_COLOR[row.confidence] }}
                    title={`${row.confidence} confidence`}
                  />
                )}
                <input
                  value={row.name}
                  onChange={(e) => updateItem(row.clientId, { name: e.target.value })}
                  placeholder="Item name"
                  className="flex-1 min-w-0 rounded-lg bg-white/[0.06] px-2 py-1.5 text-subhead outline-none"
                />
                <select
                  value={row.timeSlot}
                  onChange={(e) => updateItem(row.clientId, { timeSlot: e.target.value })}
                  className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-caption outline-none shrink-0"
                >
                  {TIME_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeItem(row.clientId)}
                  className="text-[var(--rtd-red)] text-footnote shrink-0 rounded-full cursor-pointer rtd-tap-target hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
                  aria-label={`Remove ${row.name || "item"}`}
                >
                  ✕
                </button>
              </div>

              {row.assumptions && (
                <div className="text-caption text-[var(--rtd-text-secondary)]">{row.assumptions}</div>
              )}
              {row.handEdited && (
                <span className="text-caption font-semibold uppercase tracking-wide text-[var(--rtd-orange)] self-start">
                  Manual edit
                </span>
              )}

              <div className="grid grid-cols-4 gap-1.5">
                <input
                  placeholder="kcal"
                  inputMode="numeric"
                  value={row.kcal}
                  onChange={(e) => editMacro(row.clientId, "kcal", e.target.value)}
                  className="rounded-lg bg-white/[0.06] px-1.5 py-1.5 text-center outline-none"
                  aria-label={`${row.name || "item"} calories`}
                />
                <input
                  placeholder="protein"
                  inputMode="numeric"
                  value={row.proteinG}
                  onChange={(e) => editMacro(row.clientId, "proteinG", e.target.value)}
                  className="rounded-lg bg-white/[0.06] px-1.5 py-1.5 text-center outline-none"
                  aria-label={`${row.name || "item"} protein grams`}
                />
                <input
                  placeholder="carbs"
                  inputMode="numeric"
                  value={row.carbsG}
                  onChange={(e) => editMacro(row.clientId, "carbsG", e.target.value)}
                  className="rounded-lg bg-white/[0.06] px-1.5 py-1.5 text-center outline-none"
                  aria-label={`${row.name || "item"} carb grams`}
                />
                <input
                  placeholder="fat"
                  inputMode="numeric"
                  value={row.fatG}
                  onChange={(e) => editMacro(row.clientId, "fatG", e.target.value)}
                  className="rounded-lg bg-white/[0.06] px-1.5 py-1.5 text-center outline-none"
                  aria-label={`${row.name || "item"} fat grams`}
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[0.5, 1.5, 2].map((factor) => (
                  <button
                    key={factor}
                    type="button"
                    onClick={() => scalePortion(row.clientId, factor)}
                    className="text-caption px-2 py-1 rounded-full bg-white/[0.06] text-[var(--rtd-text-secondary)] cursor-pointer hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out rtd-tap-target rtd-mono"
                  >
                    ×{factor}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={row.rethinking}
                  onClick={() => toggleHint(row.clientId)}
                  className="text-caption px-2 py-1 rounded-full bg-white/[0.06] text-[var(--rtd-cyan)] cursor-pointer hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out rtd-tap-target disabled:opacity-40"
                >
                  {row.rethinking ? <span className="rtd-pulse">Rethinking…</span> : "Rethink"}
                </button>

                {row.pendingOverwrite && !row.rethinking && (
                  <button
                    type="button"
                    onClick={() => rethink(row.clientId)}
                    className="text-caption px-2 py-1 rounded-full bg-[var(--rtd-orange)]/15 text-[var(--rtd-orange)] cursor-pointer hover:brightness-110 focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out rtd-tap-target"
                  >
                    Rethink anyway (overwrites your edits)
                  </button>
                )}
              </div>

              {row.showHint && !row.rethinking && (
                <div className="flex items-center gap-1.5">
                  <input
                    value={row.hint}
                    onChange={(e) => updateItem(row.clientId, { hint: e.target.value })}
                    placeholder='optional hint, e.g. "big serving", "air-fried"'
                    className="flex-1 rounded-lg bg-white/[0.06] px-2 py-1.5 text-footnote outline-none"
                  />
                  <Button variant="secondary" onClick={() => rethink(row.clientId)}>
                    Go
                  </Button>
                </div>
              )}
              {row.rethinkError && (
                <div className="text-caption text-[var(--rtd-red)]">
                  Couldn&apos;t rethink this one — AI estimation is unavailable right now.
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addManualItem}
            className="rtd-tap-target text-footnote text-[var(--rtd-text-secondary)] cursor-pointer hover:text-[var(--rtd-text)] transition-colors duration-150 ease-out self-start"
          >
            + Add item manually
          </button>

          <div className="flex gap-2">
            <Button variant="primary" disabled={saving || items.length === 0} onClick={confirmLog} className="flex-1">
              Log {items.length} item{items.length === 1 ? "" : "s"}
            </Button>
            <Button variant="ghost" disabled={saving} onClick={() => setItems(null)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </TerminalPanel>
  );
}
