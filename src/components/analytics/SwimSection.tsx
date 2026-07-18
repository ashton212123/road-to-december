"use client";

import { useTransition } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { SeedPbRow, SeedTarget, SeedSplitBar } from "@/lib/data/types";
import { chartTheme } from "./chart-theme";
import { SwimTimeLogger } from "./SwimTimeLogger";
import { SwimHero } from "./SwimHero";
import { AddMeetForm } from "./AddMeetForm";
import { MeetsList } from "./MeetsList";
import { SwimSessionLogger } from "./SwimSessionLogger";
import { SwimSessionList } from "./SwimSessionList";
import { deleteSwimTimeAction } from "@/app/(app)/analytics/actions";
import { formatSwimTime } from "@/lib/swim/format";
import type { ReadinessResult } from "@/lib/swim/readiness";

type RecentSwimTime = { id: number; date: string; event: string; timeMs: number; meetName: string | null };
type MeetWithEvents = {
  id: number;
  name: string;
  date: string;
  events: { id: number; event: string; currentTimeMs: number | null; targetTimeMs: number; readiness: ReadinessResult }[];
};
type SwimSessionRow = { id: number; date: string; loadRating: number; setsText: string | null; parsedDistanceM: number | null };

export function SwimSection({
  pbRows,
  targets,
  splitBars,
  splitAutopsy,
  timeTo15m,
  recentTimes,
  allSwimTimesByEvent,
  meets,
  latestTimeByEvent,
  swimSessions,
}: {
  pbRows: SeedPbRow[];
  targets: SeedTarget[];
  splitBars: SeedSplitBar[];
  splitAutopsy: { date: string; splits: number[]; strokeCounts: number[] }[];
  timeTo15m: { date: string; seconds: number; condition: string }[];
  recentTimes: RecentSwimTime[];
  allSwimTimesByEvent: Record<string, { date: string; timeMs: number }[]>;
  meets: MeetWithEvents[];
  latestTimeByEvent: Record<string, number>;
  swimSessions: SwimSessionRow[];
}) {
  const swimTarget = targets.find((t) => t.id === "swim_200br_200im");
  const [pending, startTransition] = useTransition();

  const meetEventsFlat = meets.flatMap((m) =>
    m.events.map((e) => ({ event: e.event, targetTimeMs: e.targetTimeMs, readiness: e.readiness, meetName: m.name, meetDate: m.date }))
  );

  return (
    <div className="flex flex-col gap-4">
      <SwimHero allSwimTimesByEvent={allSwimTimesByEvent} meetEventsFlat={meetEventsFlat} />

      <div>
        <SectionLabel>Meets & targets</SectionLabel>
        <div className="flex flex-col gap-3">
          <MeetsList meets={meets} />
          <AddMeetForm latestTimeByEvent={latestTimeByEvent} />
        </div>
      </div>

      <div>
        <SectionLabel>Swim training log</SectionLabel>
        <div className="flex flex-col gap-3">
          <SwimSessionLogger />
          <SwimSessionList sessions={swimSessions} />
        </div>
      </div>

      <SwimTimeLogger />

      <div>
        <SectionLabel>Recent logged times</SectionLabel>
        <GlassCard className="flex flex-col gap-2">
          {recentTimes.length === 0 ? (
            <EmptyState title="No times logged yet" body="Log one above after your next set or meet." />
          ) : (
            recentTimes.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-footnote">
                <div className="min-w-0">
                  <span className="text-[var(--rtd-text)] font-medium">{t.event}</span>{" "}
                  <span className="text-[var(--rtd-text-secondary)]">{formatSwimTime(t.timeMs)}</span>
                  <div className="text-caption text-[var(--rtd-text-secondary)]">
                    {t.date}
                    {t.meetName ? ` · ${t.meetName}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(() => deleteSwimTimeAction(t.id))}
                  className="rtd-tap-target text-[var(--rtd-red)] ml-2 shrink-0 cursor-pointer hover:bg-white/[0.04] active:scale-[0.98] transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
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
