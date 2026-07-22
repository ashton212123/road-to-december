"use client";

import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { SeedPbRow, SeedTarget, SeedSplitBar } from "@/lib/data/types";
import { RACE_PLANS, RACE_SKILL_NOTE } from "@/lib/swim/racePlans";
import { chartTheme } from "./chart-theme";

function formatSec(s: number): string {
  return Number.isInteger(s) ? `${s}` : s.toFixed(1);
}

/** The recharts-dependent half of the old monolithic SwimSection, split out
 * so /swim only ever loads the recharts bundle when the Analysis view is
 * actually opened (next/dynamic import site: swim/page.tsx). Log and Meets
 * views never touch this module. */
export function SwimAnalysisView({
  pbRows,
  targets,
  splitBars,
  splitAutopsy,
  timeTo15m,
}: {
  pbRows: SeedPbRow[];
  targets: SeedTarget[];
  splitBars: SeedSplitBar[];
  splitAutopsy: { date: string; splits: number[]; strokeCounts: number[]; isRace: boolean }[];
  timeTo15m: { date: string; seconds: number; condition: string }[];
}) {
  const swimTarget = targets.find((t) => t.id === "swim_200br_200im");
  const latestRaceSplits = splitAutopsy.find((s) => s.isRace) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <SectionLabel>Race plans</SectionLabel>
        <GlassCard className="flex flex-col gap-4">
          {RACE_PLANS.map((plan) => {
            const deltas =
              plan.targetSplits && plan.targetSplits.length === 4 && latestRaceSplits && plan.event === "200 Breast"
                ? latestRaceSplits.splits.map((actual, i) => actual - (plan.targetSplits as number[])[i])
                : null;
            return (
              <div key={plan.event} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-subhead font-semibold text-[var(--rtd-text)]">{plan.event}</span>
                  {plan.targetLabel && <span className="text-caption text-[var(--rtd-text-tertiary)]">{plan.targetLabel}</span>}
                </div>
                {plan.targetSplits && (
                  <div className="flex gap-1.5">
                    {plan.targetSplits.map((s, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-full bg-white/[0.06] text-caption font-semibold text-[var(--rtd-text)] rtd-nums"
                      >
                        {formatSec(s)}
                      </span>
                    ))}
                  </div>
                )}
                {deltas && (
                  <div className="flex gap-1.5">
                    {deltas.map((d, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 rounded-full text-caption font-semibold rtd-nums"
                        style={{
                          background: d <= 0 ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
                          color: d <= 0 ? "var(--rtd-green)" : "var(--rtd-red)",
                        }}
                      >
                        {d > 0 ? "+" : ""}
                        {formatSec(d)}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-caption text-[var(--rtd-text-secondary)] leading-snug">{plan.strategy}</p>
              </div>
            );
          })}
          <p className="text-caption text-[var(--rtd-text-tertiary)] pt-1 border-t border-[var(--rtd-hairline)]">{RACE_SKILL_NOTE}</p>
        </GlassCard>
      </div>

      <div>
        <SectionLabel>Personal bests vs goal</SectionLabel>
        <GlassCard className="flex flex-col gap-2">
          {pbRows.map((row) => (
            <div key={row.name} className="flex items-center justify-between text-footnote">
              <span className="text-[var(--rtd-text-secondary)]">{row.name}</span>
              <span className="font-semibold" style={{ color: row.color.startsWith("#") ? row.color : "var(--rtd-text)" }}>
                {row.time}
              </span>
            </div>
          ))}
          {swimTarget && (
            <div className="pt-2 mt-1 border-t border-[var(--rtd-hairline)] text-caption text-[var(--rtd-text-secondary)]">
              Goal: {swimTarget.goal} · {swimTarget.why}
            </div>
          )}
        </GlassCard>
      </div>

      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
        <div>
          <SectionLabel>200 BR split autopsy — you vs target (% of race)</SectionLabel>
          <GlassCard>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={splitBars} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...chartTheme.grid} />
                <XAxis dataKey="label" {...chartTheme.axis} />
                <YAxis {...chartTheme.axis} unit="%" />
                <Tooltip {...chartTheme.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="targetPct" name="Target" fill="rgba(235,235,245,0.25)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="yourPct" name="Your race" fill="var(--rtd-blue)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-caption text-[var(--rtd-text-secondary)] mt-2">
              The 4th 50 gap is the whole story — hold 37.5 on the last 50 and the target time is there.
            </p>
          </GlassCard>
        </div>

        <div>
          <SectionLabel>Time to 15m (dive) — the #1 weakness metric</SectionLabel>
          <GlassCard>
            {timeTo15m.length === 0 ? (
              <EmptyState title="No time-to-15m logs yet" body="Ask coach to hand-time 3 dives, fresh and fatigued." />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={[...timeTo15m].reverse()} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid {...chartTheme.grid} />
                  <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d) => d.slice(5)} />
                  <YAxis {...chartTheme.axis} unit="s" domain={["dataMin - 0.2", "dataMax + 0.2"]} />
                  <Tooltip {...chartTheme.tooltip} />
                  <Line type="monotone" dataKey="seconds" stroke="var(--rtd-red)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </div>
      </div>

      <div>
        <SectionLabel>Stroke counts per 50 (200 BR)</SectionLabel>
        <GlassCard className="flex flex-col gap-2">
          {splitAutopsy.length === 0 ? (
            <EmptyState title="No 200 BR splits logged yet" body="Log exact 50-splits and stroke counts after your next meet." />
          ) : (
            splitAutopsy.map((race) => (
              <div key={race.date} className="flex items-center justify-between text-footnote">
                <span className="text-[var(--rtd-text-secondary)]">{race.date}</span>
                <span className="text-[var(--rtd-text)]">{race.strokeCounts.join(" · ") || "—"}</span>
              </div>
            ))
          )}
        </GlassCard>
      </div>
    </div>
  );
}
