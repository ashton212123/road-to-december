"use client";

import { useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { ComparisonLine, ComparisonLegend } from "@/components/ui/ComparisonLine";
import { GlassTooltip, PatternLegend } from "./ChartTooltip";
import { gridDotted, axisClean, CAPSULE_BAR_SIZE, CAPSULE_BAR_RADIUS, barTrack, PATTERN_COLORS } from "./chart-theme";
import { currentVsPreviousDaily, periodDayLabels } from "@/lib/analytics/periodCompare";
import type { DailySessionLoad, AcwrPoint } from "@/lib/analytics/load";
import type { TonnageRow, HardSetRow } from "@/lib/analytics/tonnage";
import type { Period } from "@/lib/analytics/periods";

const PATTERN_LEGEND = [
  { label: "Squat", color: PATTERN_COLORS.squat },
  { label: "Hinge", color: PATTERN_COLORS.hinge },
  { label: "Press", color: PATTERN_COLORS.press },
  { label: "Pull", color: PATTERN_COLORS.pull },
];

const TABS = [
  { key: "tonnage", label: "Tonnage" },
  { key: "hardSets", label: "Hard sets" },
  { key: "sessions", label: "Sessions" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** No-data placeholder that doesn't carry its own panel surface -- it's
 * always used inside a TerminalPanel already, and a nested panel border
 * would double up the hairline (see Fix 5). */
function ChartEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col justify-end gap-1 pb-0.5" style={{ height: 180 }}>
      <div className="w-full border-t border-dashed" style={{ borderColor: "var(--rtd-hairline)" }} />
      <span className="text-caption text-[var(--rtd-text-tertiary)]">{children}</span>
    </div>
  );
}

export function LoadSection({
  dailyLoads,
  acwr,
  tonnage,
  hardSets,
  weeklySessions,
  today,
  period,
  offset,
}: {
  dailyLoads: DailySessionLoad[];
  acwr: AcwrPoint[];
  tonnage: TonnageRow[];
  hardSets: HardSetRow[];
  weeklySessions: { weekStart: string; count: number }[];
  today: string;
  period: Period;
  offset: number;
}) {
  const [tab, setTab] = useState<TabKey>("tonnage");
  const periodWord = period === "week" ? "week" : "month";

  const acwrRows = acwr.filter((a) => a.ratio !== null).map((a) => ({ date: a.date, value: a.ratio as number }));
  const acwrCmp = currentVsPreviousDaily(acwrRows, period, today, offset);
  const acwrLabels = periodDayLabels(period, acwrCmp.current.length);

  const tabData = tab === "sessions" ? weeklySessions : tab === "tonnage" ? tonnage : hardSets;

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
      <div>
        <SectionHeader title="Daily session load (RPE × time-on-task)" className="mb-2" />
        <TerminalPanel variant="open">
          {dailyLoads.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <ChartEmpty>No sessions logged yet</ChartEmpty>
              <Link href="/train">
                <Button variant="secondary">Log sets in Train</Button>
              </Link>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyLoads} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...gridDotted} />
                <XAxis dataKey="date" {...axisClean} tickFormatter={(d) => d.slice(5)} />
                <YAxis {...axisClean} />
                <Tooltip content={<GlassTooltip color="var(--rtd-blue)" />} cursor={false} />
                <Bar
                  dataKey="load"
                  fill="var(--rtd-blue)"
                  barSize={CAPSULE_BAR_SIZE}
                  radius={CAPSULE_BAR_RADIUS}
                  background={barTrack}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </TerminalPanel>
      </div>

      <div>
        <SectionHeader title="Acute (7d) : Chronic (28d) ratio" className="mb-2" />
        <TerminalPanel variant="open" className="gap-2">
          {acwr.length === 0 ? (
            <ChartEmpty>ACWR needs at least a week of logged sessions</ChartEmpty>
          ) : (
            <>
              <ComparisonLegend
                currentLabel={`This ${periodWord}`}
                previousLabel={`Last ${periodWord}`}
                color="var(--rtd-orange)"
                previousAvailable={acwrCmp.hasPrevious}
              />
              <ComparisonLine current={acwrCmp.current} previous={acwrCmp.previous} color="var(--rtd-orange)" height={140} labels={acwrLabels} />
            </>
          )}
          <div className="text-caption text-[var(--rtd-text-tertiary)] pt-1 border-t border-[var(--rtd-hairline)]">
            Acute-to-chronic ratios are widely used but have known statistical problems and no demonstrated causal link to injury [strong critique — Impellizzeri 2020] — shown here as a description of training load, not a risk score.
          </div>
        </TerminalPanel>
      </div>

      <div className="md:col-span-2">
        <div className="flex items-center justify-between mb-1">
          <SectionHeader title="Weekly load breakdown" />
          <div className="flex items-center gap-4">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className="relative text-footnote font-medium pb-2 cursor-pointer transition-colors duration-150 ease-out"
                style={{ color: tab === t.key ? "var(--rtd-text)" : "var(--rtd-text-tertiary)" }}
              >
                {t.label}
                <span
                  className="absolute left-1/2 bottom-0 w-1 h-1 rounded-full bg-white transition-[transform,opacity] duration-150 ease-out"
                  style={{
                    transform: tab === t.key ? "translateX(-50%) scale(1)" : "translateX(-50%) scale(0)",
                    opacity: tab === t.key ? 1 : 0,
                  }}
                />
              </button>
            ))}
          </div>
        </div>
        <TerminalPanel variant="open" className="gap-2">
          {tabData.length === 0 ? (
            <ChartEmpty>
              {tab === "sessions" ? "No sessions logged yet" : tab === "tonnage" ? "No tonnage yet" : "No hard sets logged yet"}
            </ChartEmpty>
          ) : (
            <>
              {tab !== "sessions" && <PatternLegend patterns={PATTERN_LEGEND} />}
              <ResponsiveContainer width="100%" height={200}>
                {tab === "sessions" ? (
                  <BarChart data={weeklySessions} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...gridDotted} />
                    <XAxis dataKey="weekStart" {...axisClean} tickFormatter={(d) => d.slice(5)} />
                    <YAxis {...axisClean} allowDecimals={false} />
                    <Tooltip content={<GlassTooltip color="var(--rtd-blue)" />} cursor={false} />
                    <Bar dataKey="count" name="Sessions" fill="var(--rtd-blue)" barSize={CAPSULE_BAR_SIZE} radius={CAPSULE_BAR_RADIUS} background={barTrack} />
                  </BarChart>
                ) : (
                  <BarChart data={tab === "tonnage" ? tonnage : hardSets} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...gridDotted} />
                    <XAxis dataKey="weekStart" {...axisClean} tickFormatter={(d) => d.slice(5)} />
                    <YAxis {...axisClean} allowDecimals={tab !== "hardSets"} />
                    <Tooltip content={<GlassTooltip />} cursor={false} />
                    <Bar dataKey="squat" stackId="a" fill={PATTERN_COLORS.squat} radius={CAPSULE_BAR_RADIUS} background={barTrack} barSize={CAPSULE_BAR_SIZE} />
                    <Bar dataKey="hinge" stackId="a" fill={PATTERN_COLORS.hinge} radius={CAPSULE_BAR_RADIUS} barSize={CAPSULE_BAR_SIZE} />
                    <Bar dataKey="press" stackId="a" fill={PATTERN_COLORS.press} radius={CAPSULE_BAR_RADIUS} barSize={CAPSULE_BAR_SIZE} />
                    <Bar dataKey="pull" stackId="a" fill={PATTERN_COLORS.pull} radius={CAPSULE_BAR_RADIUS} barSize={CAPSULE_BAR_SIZE} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </>
          )}
        </TerminalPanel>
      </div>
    </div>
  );
}
