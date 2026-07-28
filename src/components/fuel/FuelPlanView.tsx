"use client";

import { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiniBarList } from "@/components/ui/MiniBarList";
import { chartTheme } from "@/components/analytics/chart-theme";
import { evidenceLabel } from "@/lib/swim/evidence";
import type { EnergyTarget } from "@/lib/fuel/energyModel";
import type { DayFuelPlan } from "@/lib/fuel/carbPeriodization";

const BASIS_LABEL: Record<EnergyTarget["basis"], string> = {
  "weight-response": "From your measured weight response",
  estimate: "Seed estimate (Schofield BMR)",
  override: "Manually set",
};

const CONFIDENCE_COLOR: Record<EnergyTarget["confidence"], string> = {
  high: "var(--rtd-green)",
  medium: "var(--rtd-orange)",
  low: "var(--rtd-text-tertiary)",
};

const DEMAND_COLOR: Record<DayFuelPlan["dayDemand"], string> = {
  rest: "var(--rtd-text-tertiary)",
  moderate: "var(--rtd-cyan)",
  high: "var(--rtd-orange)",
  "very-high": "var(--rtd-red)",
};

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function DayRow({ plan, isToday }: { plan: DayFuelPlan; isToday: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col rtd-divide-y">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 py-2 text-left cursor-pointer hover:bg-white/[0.03] transition-colors duration-150 ease-out rounded-lg -mx-1 px-1"
      >
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ background: DEMAND_COLOR[plan.dayDemand] }}
          aria-hidden="true"
        />
        <span className="w-9 shrink-0 text-footnote font-semibold text-[var(--rtd-text)]">
          {shortDate(plan.dateISO)}
          {isToday && <span className="text-[var(--rtd-cyan)]"> •</span>}
        </span>
        <span className="text-caption text-[var(--rtd-text-secondary)] flex-1 truncate">{plan.dayDemand} demand</span>
        <span className="text-footnote rtd-nums rtd-mono text-[var(--rtd-text)]">{plan.kcal.toLocaleString()} kcal</span>
        <span className="text-caption rtd-nums rtd-mono text-[var(--rtd-text-tertiary)] w-16 text-right">{plan.carbGPerKg}g/kg C</span>
      </button>
      {open && (
        <div className="pb-2.5 pl-4 flex flex-col gap-1.5 rtd-fade-in">
          <div className="flex gap-3 text-caption rtd-nums rtd-mono text-[var(--rtd-text-secondary)]">
            <span>C {plan.carbsG}g ({plan.carbGPerKg}g/kg)</span>
            <span>P {plan.proteinG}g</span>
            <span>F {plan.fatG}g</span>
          </div>
          <p className="text-caption text-[var(--rtd-text-secondary)] leading-snug">{plan.why}</p>
          {plan.timing.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-1">
              {plan.timing.map((t, i) => (
                <div key={i} className="text-caption">
                  <span className="font-semibold text-[var(--rtd-text)]">{t.when}:</span>{" "}
                  <span className="text-[var(--rtd-text-secondary)]">{t.what}.</span>{" "}
                  <span className="text-[var(--rtd-text-tertiary)]">{t.why}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FuelPlanView({
  energyTarget,
  phaseDaysLeft,
  phaseTransitionExplainer,
  weightTrend,
  weekPlan,
  todayISO,
  proteinTargetG,
  proteinByMealSlotToday,
}: {
  energyTarget: EnergyTarget;
  phaseDaysLeft: number | null;
  phaseTransitionExplainer: string;
  weightTrend: { date: string; kg: number }[];
  weekPlan: DayFuelPlan[];
  todayISO: string;
  proteinTargetG: { min: number; max: number; mid: number };
  proteinByMealSlotToday: { label: string; value: number }[];
}) {
  const phaseLabel = energyTarget.phase === "gain" ? "Gain" : energyTarget.phase === "sharpen" ? "Sharpen" : "Maintain";
  const chartData = weightTrend.map((w) => ({ date: w.date, kg: w.kg }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionHeader title="Current phase" className="mb-2" />
        <TerminalPanel variant="open">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-title-3 font-semibold text-[var(--rtd-text)]">
              {phaseLabel} phase{phaseDaysLeft !== null && phaseDaysLeft >= 0 ? ` · ${phaseDaysLeft}d left` : ""}
            </span>
            <span className="text-caption font-semibold px-2 py-0.5 rounded-full" style={{ background: `${CONFIDENCE_COLOR[energyTarget.confidence]}22`, color: CONFIDENCE_COLOR[energyTarget.confidence] }}>
              {energyTarget.confidence} confidence
            </span>
          </div>
          <p className="text-caption text-[var(--rtd-text-secondary)] leading-snug">{phaseTransitionExplainer}</p>
        </TerminalPanel>
      </div>

      <div>
        <SectionHeader title="Energy target" className="mb-2" />
        <TerminalPanel variant="open">
          <div className="flex items-baseline gap-2">
            <span className="rtd-display text-title-1 rtd-nums rtd-mono">{energyTarget.kcal.toLocaleString()}</span>
            <span className="text-subhead text-[var(--rtd-text-secondary)] rtd-nums rtd-mono">kcal/day ({energyTarget.low.toLocaleString()}-{energyTarget.high.toLocaleString()})</span>
          </div>
          <span className="text-caption text-[var(--rtd-text-tertiary)]">{BASIS_LABEL[energyTarget.basis]}</span>
          <p className="text-caption text-[var(--rtd-text-secondary)] leading-snug">{energyTarget.rationale}</p>

          {chartData.length >= 2 ? (
            <div className="mt-1">
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid {...chartTheme.grid} />
                  <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d) => d.slice(5)} />
                  <YAxis {...chartTheme.axis} domain={["dataMin - 0.5", "dataMax + 0.5"]} />
                  <Tooltip {...chartTheme.tooltip} />
                  <Line type="monotone" dataKey="kg" stroke="var(--rtd-cyan)" strokeWidth={2} dot={{ r: 2 }} />
                  {chartData.length > 0 && (
                    <ReferenceLine
                      y={chartData[0].kg + (energyTarget.targetRateKgPerWk * chartData.length) / 7}
                      stroke="var(--rtd-green)"
                      strokeDasharray="3 3"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
              <p className="text-caption text-[var(--rtd-text-tertiary)] mt-1">Dashed line: target trajectory at {energyTarget.targetRateKgPerWk >= 0 ? "+" : ""}{energyTarget.targetRateKgPerWk.toFixed(2)} kg/wk.</p>
            </div>
          ) : (
            <EmptyState title="Not enough weigh-ins yet" body="Log weight regularly to see your trend against the target rate." />
          )}
        </TerminalPanel>
      </div>

      <div>
        <SectionHeader title="This week's day-by-day plan" className="mb-2" />
        <TerminalPanel variant="open" gap="none">
          {weekPlan.map((plan) => (
            <DayRow key={plan.dateISO} plan={plan} isToday={plan.dateISO === todayISO} />
          ))}
        </TerminalPanel>
      </div>

      <div>
        <SectionHeader title="Protein distribution" className="mb-2" />
        <TerminalPanel variant="open">
          <p className="text-caption text-[var(--rtd-text-secondary)]">
            Target: ~{Math.round(proteinTargetG.mid / 4)}g × 4-5 feedings across the day ({evidenceLabel("E10")}).
          </p>
          {proteinByMealSlotToday.length > 0 ? (
            <MiniBarList rows={proteinByMealSlotToday} color="var(--rtd-green)" formatValue={(v) => `${v}g`} />
          ) : (
            <p className="text-caption text-[var(--rtd-text-tertiary)]">No protein logged yet today.</p>
          )}
        </TerminalPanel>
      </div>

      <div>
        <SectionHeader title="What changes and when" className="mb-2" />
        <TerminalPanel variant="open">
          <p className="text-caption text-[var(--rtd-text-secondary)] leading-snug">{phaseTransitionExplainer}</p>
          <p className="text-caption text-[var(--rtd-text-tertiary)] leading-snug">
            Carb targets move with training demand every day ({evidenceLabel("E9")}) — rest days sit at 5g/kg, very-high-demand days (doubles, 5 AM race-pace) at 10g/kg. Protein and the 0.8g/kg fat floor stay constant across the phase.
          </p>
        </TerminalPanel>
      </div>
    </div>
  );
}
