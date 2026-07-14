"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid, BarChart, Bar } from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AlertCard } from "@/components/ui/AlertCard";
import type { DailySessionLoad, AcwrPoint } from "@/lib/analytics/load";
import { chartTheme } from "./chart-theme";

export function LoadSection({ dailyLoads, acwr }: { dailyLoads: DailySessionLoad[]; acwr: AcwrPoint[] }) {
  const latestRatio = acwr.length > 0 ? acwr[acwr.length - 1].ratio : null;
  const flagged = latestRatio !== null && latestRatio > 1.5;

  return (
    <div className="flex flex-col gap-4">
      {flagged && (
        <AlertCard
          tone="danger"
          title="Acute:chronic ratio elevated"
          body={`Current ratio ${latestRatio!.toFixed(2)} is above 1.5 — trim this week's volume before it compounds.`}
        />
      )}

      <div>
        <SectionLabel>Daily session load (RPE × time-on-task)</SectionLabel>
        <GlassCard>
          {dailyLoads.length === 0 ? (
            <EmptyState title="No sessions logged yet" />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailyLoads} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...chartTheme.grid} />
                <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d) => d.slice(5)} />
                <YAxis {...chartTheme.axis} />
                <Tooltip {...chartTheme.tooltip} />
                <Bar dataKey="load" fill="var(--rtd-blue)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>

      <div>
        <SectionLabel>Acute (7d) : Chronic (28d) ratio</SectionLabel>
        <GlassCard>
          {acwr.length === 0 ? (
            <EmptyState title="Not enough history yet" body="ACWR needs at least a week of logged sessions." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={acwr} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...chartTheme.grid} />
                <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d) => d.slice(5)} />
                <YAxis {...chartTheme.axis} domain={[0, "dataMax + 0.5"]} />
                <Tooltip {...chartTheme.tooltip} />
                <ReferenceLine y={1.5} stroke="var(--rtd-red)" strokeDasharray="4 4" label={{ value: "1.5 — trim volume", position: "insideTopRight", fill: "var(--rtd-red)", fontSize: 10 }} />
                <Area type="monotone" dataKey="ratio" stroke="var(--rtd-orange)" fill="var(--rtd-orange)" fillOpacity={0.15} strokeWidth={2} connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
