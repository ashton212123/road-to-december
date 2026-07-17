"use client";

import { useTransition } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { SeedPbRow, SeedTarget, SeedSplitBar } from "@/lib/data/types";
import { chartTheme } from "./chart-theme";
import { SwimTimeLogger } from "./SwimTimeLogger";
import { deleteSwimTimeAction } from "@/app/(app)/analytics/actions";
import { formatSwimTime } from "@/lib/swim/format";

type RecentSwimTime = { id: number; date: string; event: string; timeMs: number; meetName: string | null };

export function SwimSection({
  pbRows,
  targets,
  splitBars,
  splitAutopsy,
  timeTo15m,
  recentTimes,
}: {
  pbRows: SeedPbRow[];
  targets: SeedTarget[];
  splitBars: SeedSplitBar[];
  splitAutopsy: { date: string; splits: number[]; strokeCounts: number[] }[];
  timeTo15m: { date: string; seconds: number; condition: string }[];
  recentTimes: RecentSwimTime[];
}) {
  const swimTarget = targets.find((t) => t.id === "swim_200br_200im");
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <SwimTimeLogger />

      <div>
        <SectionLabel>Recent logged times</SectionLabel>
        <GlassCard className="flex flex-col gap-2">
          {recentTimes.length === 0 ? (
            <EmptyState title="No times logged yet" body="Log one above after your next set or meet." />
          ) : (
            recentTimes.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-xs">
                <div className="min-w-0">
                  <span className="text-[var(--rtd-text)] font-medium">{t.event}</span>{" "}
                  <span className="text-[var(--rtd-text-secondary)]">{formatSwimTime(t.timeMs)}</span>
                  <div className="text-[10px] text-[var(--rtd-text-tertiary)]">
                    {t.date}
                    {t.meetName ? ` · ${t.meetName}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(() => deleteSwimTimeAction(t.id))}
                  className="text-[var(--rtd-red)] ml-2 shrink-0"
                  aria-label="Delete swim time"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </GlassCard>
      </div>

      <div>
        <SectionLabel>Personal bests vs goal</SectionLabel>
        <GlassCard className="flex flex-col gap-2">
          {pbRows.map((row) => (
            <div key={row.name} className="flex items-center justify-between text-xs">
              <span className="text-[var(--rtd-text-secondary)]">{row.name}</span>
              <span className="font-semibold" style={{ color: row.color.startsWith("#") ? row.color : "var(--rtd-text)" }}>
                {row.time}
              </span>
            </div>
          ))}
          {swimTarget && (
            <div className="pt-2 mt-1 border-t border-[var(--rtd-hairline)] text-[10px] text-[var(--rtd-text-tertiary)]">
              Goal: {swimTarget.goal} · {swimTarget.why}
            </div>
          )}
        </GlassCard>
      </div>

      <div>
        <SectionLabel>200 BR split autopsy — you vs target (% of race)</SectionLabel>
        <GlassCard>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={splitBars} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...chartTheme.grid} />
              <XAxis dataKey="label" {...chartTheme.axis} />
              <YAxis {...chartTheme.axis} unit="%" />
              <Tooltip {...chartTheme.tooltip} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="targetPct" name="Target" fill="rgba(235,235,245,0.25)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="yourPct" name="Your race" fill="var(--rtd-blue)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] text-[var(--rtd-text-tertiary)] mt-2">
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

      <div>
        <SectionLabel>Stroke counts per 50 (200 BR)</SectionLabel>
        <GlassCard className="flex flex-col gap-2">
          {splitAutopsy.length === 0 ? (
            <EmptyState title="No 200 BR splits logged yet" body="Log exact 50-splits and stroke counts after your next meet." />
          ) : (
            splitAutopsy.map((race) => (
              <div key={race.date} className="flex items-center justify-between text-xs">
                <span className="text-[var(--rtd-text-tertiary)]">{race.date}</span>
                <span className="text-[var(--rtd-text)]">{race.strokeCounts.join(" · ") || "—"}</span>
              </div>
            ))
          )}
        </GlassCard>
      </div>
    </div>
  );
}
