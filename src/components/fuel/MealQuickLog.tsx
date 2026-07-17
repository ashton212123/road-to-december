"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { parseMealTextAction, logMealBatchAction, type ParsedMealReviewItem } from "@/app/(app)/fuel/actions";

const TIME_SLOTS = ["pre_race_pace", "breakfast", "lunch", "pre_gym", "dinner", "snack", "bedtime"];

type ReviewRow = {
  timeSlot: string;
  description: string;
  kcal: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  candidates: ParsedMealReviewItem["candidates"];
  selectedFdcId: number | null;
};

export function MealQuickLog() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  function parse() {
    if (!text.trim()) return;
    setDone(false);
    startTransition(async () => {
      const parsed = await parseMealTextAction(text);
      setRows(
        parsed.map((p) => {
          const best = p.candidates[0];
          return {
            timeSlot: p.timeSlot,
            description: p.foodText,
            kcal: best?.kcal !== null && best?.kcal !== undefined ? String(Math.round(best.kcal)) : "",
            proteinG: best?.proteinG !== null && best?.proteinG !== undefined ? String(Math.round(best.proteinG)) : "",
            carbsG: best?.carbsG !== null && best?.carbsG !== undefined ? String(Math.round(best.carbsG)) : "",
            fatG: best?.fatG !== null && best?.fatG !== undefined ? String(Math.round(best.fatG)) : "",
            candidates: p.candidates,
            selectedFdcId: best?.fdcId ?? null,
          };
        })
      );
    });
  }

  function updateRow(index: number, patch: Partial<ReviewRow>) {
    setRows((prev) => (prev ? prev.map((r, i) => (i === index ? { ...r, ...patch } : r)) : prev));
  }

  function selectCandidate(index: number, fdcId: number) {
    setRows((prev) =>
      prev
        ? prev.map((r, i) => {
            if (i !== index) return r;
            const c = r.candidates.find((cand) => cand.fdcId === fdcId);
            if (!c) return r;
            return {
              ...r,
              selectedFdcId: fdcId,
              kcal: c.kcal !== null ? String(Math.round(c.kcal)) : r.kcal,
              proteinG: c.proteinG !== null ? String(Math.round(c.proteinG)) : r.proteinG,
              carbsG: c.carbsG !== null ? String(Math.round(c.carbsG)) : r.carbsG,
              fatG: c.fatG !== null ? String(Math.round(c.fatG)) : r.fatG,
            };
          })
        : prev
    );
  }

  function removeRow(index: number) {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== index) : prev));
  }

  function confirmLog() {
    if (!rows || rows.length === 0) return;
    startTransition(async () => {
      await logMealBatchAction(
        rows.map((r) => ({
          timeSlot: r.timeSlot,
          description: r.description,
          kcal: Number(r.kcal) || 0,
          proteinG: Number(r.proteinG) || 0,
          carbsG: r.carbsG ? Number(r.carbsG) : undefined,
          fatG: r.fatG ? Number(r.fatG) : undefined,
        }))
      );
      setRows(null);
      setText("");
      setDone(true);
    });
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="text-sm font-semibold">Quick log — describe your day</div>
      {!rows && (
        <>
          <textarea
            placeholder='e.g. "lunch: chicken rice, creatine, dinner adobo"'
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="rounded-lg bg-white/[0.06] px-3 py-2 text-sm outline-none resize-none"
          />
          <Button variant="secondary" disabled={pending || !text.trim()} onClick={parse}>
            {done ? "Logged ✓ — parse another" : "Parse"}
          </Button>
          <div className="text-[10px] text-[var(--rtd-text-tertiary)]">
            Macros are fuzzy-matched from USDA FoodData Central — review and edit before saving, nothing logs automatically.
          </div>
        </>
      )}

      {rows && (
        <div className="flex flex-col gap-3 rtd-fade-in">
          {rows.length === 0 && <div className="text-xs text-[var(--rtd-text-tertiary)]">Nothing parsed — try rephrasing.</div>}
          {rows.map((row, i) => (
            <div key={i} className="flex flex-col gap-2 bg-white/[0.04] rounded-xl p-2.5">
              <div className="flex items-center gap-2">
                <select
                  value={row.timeSlot}
                  onChange={(e) => updateRow(i, { timeSlot: e.target.value })}
                  className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-[11px] outline-none"
                >
                  {TIME_SLOTS.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <input
                  value={row.description}
                  onChange={(e) => updateRow(i, { description: e.target.value })}
                  className="flex-1 rounded-lg bg-white/[0.06] px-2 py-1.5 text-xs outline-none"
                />
                <button type="button" onClick={() => removeRow(i)} className="text-[var(--rtd-red)] text-xs shrink-0" aria-label="Remove item">
                  ✕
                </button>
              </div>

              {row.candidates.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto">
                  {row.candidates.map((c) => (
                    <button
                      key={c.fdcId}
                      onClick={() => selectCandidate(i, c.fdcId)}
                      className="shrink-0 text-[10px] px-2 py-1 rounded-full whitespace-nowrap"
                      style={{
                        background: row.selectedFdcId === c.fdcId ? "var(--rtd-blue)" : "rgba(255,255,255,0.06)",
                        color: row.selectedFdcId === c.fdcId ? "#fff" : "var(--rtd-text-secondary)",
                      }}
                      title={c.description}
                    >
                      {c.description.length > 24 ? `${c.description.slice(0, 24)}…` : c.description}
                    </button>
                  ))}
                </div>
              )}
              {row.candidates.length === 0 && (
                <div className="text-[10px] text-[var(--rtd-orange)]">No USDA match — enter macros manually.</div>
              )}

              <div className="grid grid-cols-4 gap-1.5">
                <input
                  placeholder="kcal"
                  inputMode="numeric"
                  value={row.kcal}
                  onChange={(e) => updateRow(i, { kcal: e.target.value })}
                  className="rounded-lg bg-white/[0.06] px-1.5 py-1.5 text-xs text-center outline-none"
                />
                <input
                  placeholder="protein"
                  inputMode="numeric"
                  value={row.proteinG}
                  onChange={(e) => updateRow(i, { proteinG: e.target.value })}
                  className="rounded-lg bg-white/[0.06] px-1.5 py-1.5 text-xs text-center outline-none"
                />
                <input
                  placeholder="carbs"
                  inputMode="numeric"
                  value={row.carbsG}
                  onChange={(e) => updateRow(i, { carbsG: e.target.value })}
                  className="rounded-lg bg-white/[0.06] px-1.5 py-1.5 text-xs text-center outline-none"
                />
                <input
                  placeholder="fat"
                  inputMode="numeric"
                  value={row.fatG}
                  onChange={(e) => updateRow(i, { fatG: e.target.value })}
                  className="rounded-lg bg-white/[0.06] px-1.5 py-1.5 text-xs text-center outline-none"
                />
              </div>
            </div>
          ))}

          <div className="flex gap-2">
            <Button variant="secondary" disabled={pending || rows.length === 0} onClick={confirmLog} className="flex-1">
              Log {rows.length} item{rows.length === 1 ? "" : "s"}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setRows(null)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
