"use client";

import Link from "next/link";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AlertCard } from "@/components/ui/AlertCard";
import { Button } from "@/components/ui/Button";
import { chartTheme } from "./chart-theme";

export function PowerSection({
  cmjSeries,
  broadJumpSeries,
}: {
  cmjSeries: { date: string; cm: number }[];
  broadJumpSeries: { date: string; cm: number }[];
}) {
  const declining =
    cmjSeries.length >= 3 &&
    cmjSeries[cmjSeries.length - 1].cm < cmjSeries[cmjSeries.length - 2].cm &&
    cmjSeries[cmjSeries.length - 2].cm < cmjSeries[cmjSeries.length - 3].cm;

  const broadJumpPb = broadJumpSeries.length > 0 ? Math.max(...broadJumpSeries.map((b) => b.cm)) : null;

  return (
    <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-4">
      {declining && (
        <div className="md:col-span-2">
          <AlertCard
            tone="danger"
            title="CMJ down 2 weeks running"
            body="Cut this week's gym volume 30% before it costs you in the pool."
          />
        </div>
      )}

      <div>
        <SectionLabel>CMJ — weekly monitor (best of 3)</SectionLabel>
        <GlassCard variant="open">
          {cmjSeries.length === 0 ? (
            <EmptyState
              title="No CMJ tests logged"
              body="Log 3 max countermovement jumps every Sunday."
              action={
                <Link href="/more/recovery">
                  <Button variant="secondary">Log a CMJ test</Button>
                </Link>
              }
            />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={cmjSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...chartTheme.grid} />
                <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d) => d.slice(5)} />
                <YAxis {...chartTheme.axis} domain={["dataMin - 2", "dataMax + 2"]} unit="cm" />
                <Tooltip {...chartTheme.tooltip} />
                <Line type="monotone" dataKey="cm" stroke="var(--rtd-red)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>

      <div>
        <SectionLabel>Broad jump progression{broadJumpPb ? ` — PB ${broadJumpPb}cm` : ""}</SectionLabel>
        <GlassCard variant="open">
          {broadJumpSeries.length === 0 ? (
            <EmptyState title="No broad jump tests logged" body="Baseline in week 1, then chase PBs through P5." />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={broadJumpSeries} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...chartTheme.grid} />
                <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d) => d.slice(5)} />
                <YAxis {...chartTheme.axis} domain={["dataMin - 5", "dataMax + 5"]} unit="cm" />
                <Tooltip {...chartTheme.tooltip} />
                <Line type="monotone" dataKey="cm" stroke="var(--rtd-purple)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
