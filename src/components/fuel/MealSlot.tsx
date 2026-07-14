"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { logFoodAction, deleteFoodLogAction } from "@/app/(app)/fuel/actions";
import { FOOD_LIBRARY } from "@/lib/fuel/food-library";

type LoggedFood = {
  id: number;
  description: string;
  kcal: number;
  proteinG: string;
};

export function MealSlot({
  time,
  desc,
  tag,
  loggedItems,
  banner,
}: {
  time: string;
  desc: string;
  tag: string;
  loggedItems: LoggedFood[];
  banner?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"quick" | "manual">("quick");
  const [manual, setManual] = useState({ description: "", kcal: "", protein: "", carbs: "", fat: "" });
  const [pending, startTransition] = useTransition();

  function quickAdd(foodId: string) {
    const food = FOOD_LIBRARY.find((f) => f.id === foodId);
    if (!food) return;
    startTransition(async () => {
      await logFoodAction({
        timeSlot: tag,
        description: food.name,
        kcal: food.kcal,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
        source: "quick",
      });
    });
  }

  function submitManual() {
    if (!manual.description || !manual.kcal) return;
    startTransition(async () => {
      await logFoodAction({
        timeSlot: tag,
        description: manual.description,
        kcal: Number(manual.kcal),
        proteinG: Number(manual.protein || 0),
        carbsG: manual.carbs ? Number(manual.carbs) : undefined,
        fatG: manual.fat ? Number(manual.fat) : undefined,
        source: "manual",
      });
      setManual({ description: "", kcal: "", protein: "", carbs: "", fat: "" });
    });
  }

  const totalKcal = loggedItems.reduce((s, i) => s + i.kcal, 0);

  return (
    <GlassCard className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-[var(--rtd-text)]">{time}</div>
          <div className="text-[11px] text-[var(--rtd-text-tertiary)] leading-snug">{desc}</div>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 w-7 h-7 rounded-full bg-white/[0.06] flex items-center justify-center text-sm text-[var(--rtd-blue)]"
          aria-label="Log food"
        >
          {open ? "–" : "+"}
        </button>
      </div>

      {banner && (
        <div className="text-[10px] text-[var(--rtd-orange)] bg-[var(--rtd-orange)]/10 rounded-lg px-2.5 py-1.5">
          {banner}
        </div>
      )}

      {loggedItems.length > 0 && (
        <div className="flex flex-col gap-1">
          {loggedItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-xs bg-white/[0.04] rounded-lg px-2.5 py-1.5">
              <span className="truncate text-[var(--rtd-text-secondary)]">{item.description}</span>
              <span className="shrink-0 ml-2 text-[var(--rtd-text-tertiary)]">
                {item.kcal} kcal
                <button
                  onClick={() => startTransition(() => deleteFoodLogAction(item.id))}
                  className="text-[var(--rtd-red)] ml-2"
                  aria-label="Delete"
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
          <div className="text-[10px] text-[var(--rtd-text-tertiary)] text-right">{totalKcal} kcal logged</div>
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-2 pt-1 border-t border-[var(--rtd-hairline)]">
          <div className="flex gap-2 text-[10px]">
            <button
              onClick={() => setMode("quick")}
              className={mode === "quick" ? "text-[var(--rtd-blue)] font-semibold" : "text-[var(--rtd-text-tertiary)]"}
            >
              Quick add
            </button>
            <button
              onClick={() => setMode("manual")}
              className={mode === "manual" ? "text-[var(--rtd-blue)] font-semibold" : "text-[var(--rtd-text-tertiary)]"}
            >
              Manual
            </button>
          </div>

          {mode === "quick" ? (
            <div className="flex flex-wrap gap-1.5">
              {FOOD_LIBRARY.map((food) => (
                <button
                  key={food.id}
                  disabled={pending}
                  onClick={() => quickAdd(food.id)}
                  className="text-[10px] px-2.5 py-1.5 rounded-full bg-white/[0.06] text-[var(--rtd-text-secondary)] disabled:opacity-40"
                >
                  {food.name} · {food.kcal}kcal
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                placeholder="Description"
                value={manual.description}
                onChange={(e) => setManual((m) => ({ ...m, description: e.target.value }))}
                className="rounded-lg bg-white/[0.06] px-3 py-2 text-xs outline-none"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {(["kcal", "protein", "carbs", "fat"] as const).map((field) => (
                  <input
                    key={field}
                    inputMode="decimal"
                    placeholder={field}
                    value={manual[field]}
                    onChange={(e) => setManual((m) => ({ ...m, [field]: e.target.value }))}
                    className="rounded-lg bg-white/[0.06] px-2 py-2 text-xs text-center outline-none"
                  />
                ))}
              </div>
              <Button variant="secondary" onClick={submitManual} disabled={pending} className="w-full">
                Add
              </Button>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
