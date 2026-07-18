"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Legend,
  CartesianGrid,
} from "recharts";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Button } from "@/components/ui/Button";
import type { TonnageRow, HardSetRow } from "@/lib/analytics/tonnage";
import { chartTheme, PATTERN_COLORS } from "./chart-theme";

export function StrengthSection({
  e1rmByLift,
  liftTargets,
  tonnage,
  hardSets,
}: {
  e1rmByLift: Record<string, { date: string; e1rm: number }[]>;
  liftTargets: Record<string, { label: string; goalKg: number }>;
  tonnage: TonnageRow[];
  hardSets: HardSetRow[];
}) {
  const lifts = Object.keys(e1rmByLift);

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
      {lifts.length === 0 ? (
        <div className="md:col-span-2">
          <EmptyState
            title="No strength logs yet"
            body="Log sets on main lifts in Train to see e1RM trends here."
            action={
              <Link href="/train">
                <Button variant="secondary">Log sets in Train</Button>
              </Link>
            }
          />
        </div>
      ) : (
        lifts.map((lift) => {
          const points = e1rmByLift[lift];
          const target = liftTargets[lift];
          return (
            <div key={lift}>
              <SectionLabel>{lift} · e1RM</SectionLabel>
              <GlassCard>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={points} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid {...chartTheme.grid} />
                    <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d) => d.slice(5)} />
                    <YAxis {...chartTheme.axis} domain={["dataMin - 5", "dataMax + 5"]} />
                    <Tooltip {...chartTheme.tooltip} />
                    {target && (
                      <ReferenceLine
                        y={target.goalKg}
                        stroke="var(--rtd-green)"
                        strokeDasharray="4 4"
                        label={{ value: `Goal ${target.goalKg}kg`, position: "insideTopRight", fill: "var(--rtd-green)", fontSize: 11 }}
                      />
                    )}
                    <Line type="monotone" dataKey="e1rm" stroke="var(--rtd-blue)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </GlassCard>
            </div>
          );
        })
      )}

      <div>
        <SectionLabel>Weekly tonnage by movement pattern (kg)</SectionLabel>
        <GlassCard>
          {tonnage.length === 0 ? (
            <EmptyState title="No tonnage yet" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tonnage} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...chartTheme.grid} />
                <XAxis dataKey="weekStart" {...chartTheme.axis} tickFormatter={(d) => d.slice(5)} />
                <YAxis {...chartTheme.axis} />
                <Tooltip {...chartTheme.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="squat" stackId="a" fill={PATTERN_COLORS.squat} />
                <Bar dataKey="hinge" stackId="a" fill={PATTERN_COLORS.hinge} />
                <Bar dataKey="press" stackId="a" fill={PATTERN_COLORS.press} />
                <Bar dataKey="pull" stackId="a" fill={PATTERN_COLORS.pull} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>

      <div>
        <SectionLabel>Weekly hard sets (RPE ≥ 8) by pattern</SectionLabel>
        <GlassCard>
          {hardSets.length === 0 ? (
            <EmptyState title="No hard sets logged yet" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hardSets} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...chartTheme.grid} />
                <XAxis dataKey="weekStart" {...chartTheme.axis} tickFormatter={(d) => d.slice(5)} />
                <YAxis {...chartTheme.axis} allowDecimals={false} />
                <Tooltip {...chartTheme.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="squat" fill={PATTERN_COLORS.squat} />
                <Bar dataKey="hinge" fill={PATTERN_COLORS.hinge} />
                <Bar dataKey="press" fill={PATTERN_COLORS.press} />
                <Bar dataKey="pull" fill={PATTERN_COLORS.pull} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
