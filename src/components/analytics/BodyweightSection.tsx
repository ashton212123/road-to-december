"use client";

import Link from "next/link";
import { ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { seasonData } from "@/lib/data/season-data";
import { daysBetween } from "@/lib/time";
import { chartTheme } from "./chart-theme";

const BASELINE_KG = 63.0;

export function BodyweightSection({ weightSeries }: { weightSeries: { date: string; kg: number; avg7: number }[] }) {
  if (weightSeries.length === 0) {
    return (
      <div>
        <SectionLabel>Bodyweight</SectionLabel>
        <GlassCard>
          <EmptyState
            title="No weigh-ins logged"
            body="Weigh in every Monday morning, same conditions — log it via Coach AI."
            action={
              <Link href="/more/coach-ai">
                <Button variant="secondary">Open Coach AI</Button>
              </Link>
            }
          />
        </GlassCard>
      </div>
    );
  }

  const chartData = weightSeries.map((w) => {
    const weeks = Math.max(0, daysBetween(seasonData.meta.seasonStart, w.date) / 7);
    return {
      ...w,
      bandLow: Math.min(66, BASELINE_KG + 0.25 * weeks),
      bandHigh: Math.min(66.5, BASELINE_KG + 0.3 * weeks),
    };
  });

  const latest = weightSeries[weightSeries.length - 1];
  const weekAgo = weightSeries.find((w) => daysBetween(w.date, latest.date) >= 7);
  const rateOfChange = weekAgo ? latest.avg7 - weekAgo.avg7 : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Latest (7d avg)" value={`${latest.avg7.toFixed(1)} kg`} />
        <StatCard
          label="Weekly rate of change"
          value={rateOfChange !== null ? `${rateOfChange >= 0 ? "+" : ""}${rateOfChange.toFixed(2)} kg` : "—"}
          sub="target +0.25–0.3 kg/wk"
          accent={rateOfChange !== null && rateOfChange >= 0.2 && rateOfChange <= 0.4 ? "var(--rtd-green)" : "var(--rtd-orange)"}
        />
      </div>

      <div>
        <SectionLabel>Bodyweight vs target band (65–66 kg by taper)</SectionLabel>
        <GlassCard>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid {...chartTheme.grid} />
              <XAxis dataKey="date" {...chartTheme.axis} tickFormatter={(d) => d.slice(5)} />
              <YAxis {...chartTheme.axis} domain={[60, 68]} unit="kg" />
              <Tooltip {...chartTheme.tooltip} />
              <Line type="monotone" dataKey="bandHigh" stroke="var(--rtd-green)" strokeDasharray="3 3" strokeWidth={1.5} dot={false} />
              <Line type="monotone" dataKey="bandLow" stroke="var(--rtd-green)" strokeDasharray="3 3" strokeWidth={1.5} dot={false} strokeOpacity={0.5} />
              <Scatter dataKey="kg" fill="rgba(235,235,245,0.5)" />
              <Line type="monotone" dataKey="avg7" stroke="var(--rtd-blue)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-caption text-[var(--rtd-text-tertiary)]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[rgba(235,235,245,0.5)]" /> Raw weigh-ins</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--rtd-blue)]" /> 7-day avg</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--rtd-green)]" /> Target band</span>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
