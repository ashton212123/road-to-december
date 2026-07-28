"use client";

import { useState } from "react";
import Link from "next/link";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { SeedPbRow, SeedTarget } from "@/lib/data/types";
import { RACE_PLANS, RACE_SKILL_NOTE } from "@/lib/swim/racePlans";
import { formatSwimTime } from "@/lib/swim/format";
import type { DpsAnalysis } from "@/lib/swim/dps";
import type { Bottleneck } from "@/lib/swim/bottlenecks";
import { chartTheme } from "./chart-theme";

function formatSec(s: number): string {
  return Number.isInteger(s) ? `${s}` : s.toFixed(1);
}

const CONFIDENCE_COLOR: Record<Bottleneck["confidence"], string> = {
  high: "var(--rtd-red)",
  medium: "var(--rtd-orange)",
  low: "var(--rtd-text-tertiary)",
};

function BottlenecksSection({ bottlenecks }: { bottlenecks: Bottleneck[] }) {
  const [showAll, setShowAll] = useState(false);
  if (bottlenecks.length === 0) return null;
  const visible = showAll ? bottlenecks : bottlenecks.slice(0, 4);

  return (
    <div>
      <SectionHeader title="Bottlenecks" className="mb-2" />
      <div className="flex flex-col gap-2.5">
        {visible.map((b) => (
          <TerminalPanel key={b.key} variant="open" fill={false}>
            <div className="flex items-start justify-between gap-2">
              <span className="text-subhead font-semibold text-[var(--rtd-text)]">{b.title}</span>
              <span
                className="shrink-0 text-caption font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                style={{ background: `${CONFIDENCE_COLOR[b.confidence]}22`, color: CONFIDENCE_COLOR[b.confidence] }}
              >
                {b.confidence}
              </span>
            </div>
            <p className="text-caption text-[var(--rtd-text-secondary)]">{b.evidence}</p>
            <p className="text-caption text-[var(--rtd-text-secondary)]">{b.mechanism}</p>
            <p className="text-footnote text-[var(--rtd-text)] font-medium">{b.whatToDo}</p>
            <p className="text-caption text-[var(--rtd-text-tertiary)]">Data used: {b.dataUsed}</p>
          </TerminalPanel>
        ))}
        {bottlenecks.length > 4 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="text-caption text-[var(--rtd-cyan)] self-start cursor-pointer hover:brightness-110"
          >
            {showAll ? "Show fewer" : `Show all ${bottlenecks.length}`}
          </button>
        )}
      </div>
    </div>
  );
}

function DpsSection({ dps, dpsMissingReason }: { dps: DpsAnalysis | null; dpsMissingReason: string | null }) {
  return (
    <div>
      <SectionHeader title="Where the race is lost" className="mb-2" />
      <TerminalPanel variant="open" fill={false}>
        {!dps || dpsMissingReason ? (
          <>
            <p className="text-caption text-[var(--rtd-text-secondary)]">{dpsMissingReason}</p>
            <Link href="/swim?view=meets#log-time" className="text-caption text-[var(--rtd-cyan)] cursor-pointer hover:brightness-110 self-start">
              Log a time with splits →
            </Link>
          </>
        ) : (
          <>
            <p className="text-subhead text-[var(--rtd-text)] leading-snug">{dps.interpretation}</p>
            <div className="flex flex-col rtd-divide-y">
              <div className="grid grid-cols-4 gap-2 text-caption text-[var(--rtd-text-tertiary)] pb-1">
                <span>Length</span>
                <span className="text-right">Split</span>
                <span className="text-right">Strokes</span>
                <span className="text-right">DPS</span>
              </div>
              {dps.lengths.map((l) => (
                <div key={l.index} className="grid grid-cols-4 gap-2 py-1.5 text-footnote rtd-nums rtd-mono">
                  <span className="text-[var(--rtd-text-secondary)]">#{l.index}</span>
                  <span className="text-right text-[var(--rtd-text)]">{formatSec(l.splitSec)}s</span>
                  <span className="text-right text-[var(--rtd-text)]">{l.strokes}</span>
                  <span className="text-right text-[var(--rtd-text)]">{l.dps.toFixed(2)}m</span>
                </div>
              ))}
            </div>
          </>
        )}
      </TerminalPanel>
    </div>
  );
}

/** The recharts-dependent half of the old monolithic SwimSection, split out
 * so /swim only ever loads the recharts bundle when the Analysis view is
 * actually opened (next/dynamic import site: swim/page.tsx). Log and Meets
 * views never touch this module. */
export function SwimAnalysisView({
  pbsByEventAndCourse,
  seedPbRows,
  targets,
  splitAutopsy,
  timeTo15m,
  dps,
  dpsMissingReason,
  bottlenecks,
}: {
  pbsByEventAndCourse: { event: string; course: "SCM" | "LCM"; timeMs: number; date: string }[];
  seedPbRows: SeedPbRow[];
  targets: SeedTarget[];
  splitAutopsy: { date: string; event: string; course: "SCM" | "LCM" | null; splits: number[]; strokeCounts: number[]; isRace: boolean }[];
  timeTo15m: { date: string; seconds: number; condition: string }[];
  dps: DpsAnalysis | null;
  dpsMissingReason: string | null;
  bottlenecks: Bottleneck[];
}) {
  const swimTarget = targets.find((t) => t.id === "swim_200br_200im");
  const latestRaceSplits = splitAutopsy.find((s) => s.isRace && s.event === "200 Breast") ?? null;
  const plan200Br = RACE_PLANS.find((p) => p.event === "200 Breast");
  const splitCompareData =
    latestRaceSplits && plan200Br?.targetSplits
      ? latestRaceSplits.splits.map((actual, i) => ({
          label: `50 #${i + 1}`,
          actual,
          target: (plan200Br.targetSplits as number[])[i],
        }))
      : [];

  return (
    <div className="flex flex-col gap-4">
      <BottlenecksSection bottlenecks={bottlenecks} />

      <DpsSection dps={dps} dpsMissingReason={dpsMissingReason} />

      <div>
        <SectionHeader title="Race plans" className="mb-2" />
        <TerminalPanel variant="open" fill={false}>
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
                        className="px-2 py-1 rounded-full bg-white/[0.06] text-caption font-semibold text-[var(--rtd-text)] rtd-nums rtd-mono"
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
                        className="px-2 py-1 rounded-full text-caption font-semibold rtd-nums rtd-mono"
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
        </TerminalPanel>
      </div>

      <div>
        <SectionHeader title="Personal bests vs goal" className="mb-2" />
        <TerminalPanel variant="open" fill={false}>
          {pbsByEventAndCourse.length > 0 ? (
            pbsByEventAndCourse.map((pb) => (
              <div key={`${pb.event}|${pb.course}`} className="flex items-center justify-between text-footnote">
                <span className="text-[var(--rtd-text-secondary)] flex items-center gap-1.5">
                  {pb.event}
                  <span className="text-caption px-1.5 py-0.5 rounded-full bg-white/[0.08] text-[var(--rtd-text-tertiary)]">{pb.course}</span>
                </span>
                <span className="font-semibold text-[var(--rtd-text)] rtd-nums rtd-mono">{formatSwimTime(pb.timeMs)}</span>
              </div>
            ))
          ) : (
            <>
              <p className="text-caption text-[var(--rtd-text-tertiary)]">From your program file — no logged race yet for this event.</p>
              {seedPbRows.map((row) => (
                <div key={row.name} className="flex items-center justify-between text-footnote">
                  <span className="text-[var(--rtd-text-secondary)]">{row.name}</span>
                  <span className="font-semibold rtd-mono" style={{ color: row.color.startsWith("#") ? row.color : "var(--rtd-text)" }}>
                    {row.time}
                  </span>
                </div>
              ))}
            </>
          )}
          {swimTarget && (
            <div className="pt-2 mt-1 border-t border-[var(--rtd-hairline)] text-caption text-[var(--rtd-text-secondary)]">
              Goal: {swimTarget.goal} · {swimTarget.why}
            </div>
          )}
        </TerminalPanel>
      </div>

      <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
        <div>
          <SectionHeader title="200 BR split autopsy — you vs target (seconds)" className="mb-2" />
          <TerminalPanel variant="open" fill={false}>
            {splitCompareData.length === 0 ? (
              <EmptyState title="No 200 BR splits logged yet" body="Log exact 50-splits after your next 200 breast race to see this." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={splitCompareData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...chartTheme.grid} />
                    <XAxis dataKey="label" {...chartTheme.axis} />
                    <YAxis {...chartTheme.axis} unit="s" />
                    <Tooltip {...chartTheme.tooltip} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="target" name="Target" fill="rgba(235,235,245,0.25)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="actual" name="Your race" fill="var(--rtd-blue)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-caption text-[var(--rtd-text-secondary)] mt-2">
                  The final-length gap is the whole story — hold the target there and the race time follows.
                </p>
              </>
            )}
          </TerminalPanel>
        </div>

        <div>
          <SectionHeader title="Time to 15m (dive) — the #1 weakness metric" className="mb-2" />
          <TerminalPanel variant="open" fill={false}>
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
          </TerminalPanel>
        </div>
      </div>

      <div>
        <SectionHeader title="Stroke counts per 50 (200 BR)" className="mb-2" />
        <TerminalPanel variant="open" fill={false}>
          {splitAutopsy.length === 0 ? (
            <EmptyState title="No 200 BR splits logged yet" body="Log exact 50-splits and stroke counts after your next meet." />
          ) : (
            splitAutopsy.map((race) => (
              <div key={race.date} className="flex items-center justify-between text-footnote">
                <span className="text-[var(--rtd-text-secondary)] rtd-mono">{race.date}</span>
                <span className="text-[var(--rtd-text)] rtd-mono">{race.strokeCounts.join(" · ") || "—"}</span>
              </div>
            ))
          )}
        </TerminalPanel>
      </div>
    </div>
  );
}
