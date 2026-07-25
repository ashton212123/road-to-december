"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Button } from "@/components/ui/Button";
import { ComparisonLine, ComparisonLegend } from "@/components/ui/ComparisonLine";
import { currentVsPreviousDaily, periodDayLabels } from "@/lib/analytics/periodCompare";
import type { Period } from "@/lib/analytics/periods";

export function StrengthSection({
  e1rmByLift,
  liftTargets,
  today,
  period,
  offset,
}: {
  e1rmByLift: Record<string, { date: string; e1rm: number }[]>;
  liftTargets: Record<string, { label: string; goalKg: number }>;
  today: string;
  period: Period;
  offset: number;
}) {
  const lifts = Object.keys(e1rmByLift);
  const periodWord = period === "week" ? "week" : "month";

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
          const target = liftTargets[lift];
          const rows = e1rmByLift[lift].map((p) => ({ date: p.date, value: p.e1rm }));
          const { current, previous, hasPrevious } = currentVsPreviousDaily(rows, period, today, offset);
          const labels = periodDayLabels(period, current.length);
          return (
            <div key={lift}>
              <SectionLabel>{lift} · e1RM</SectionLabel>
              <GlassCard variant="open" className="flex flex-col gap-2">
                <ComparisonLegend
                  currentLabel={`This ${periodWord}`}
                  previousLabel={`Last ${periodWord}`}
                  color="var(--rtd-blue)"
                  previousAvailable={hasPrevious}
                />
                <ComparisonLine current={current} previous={previous} color="var(--rtd-blue)" height={140} labels={labels} />
                {target && (
                  <div className="text-caption text-[var(--rtd-text-tertiary)]">
                    Goal <span style={{ color: "var(--rtd-green)" }}>{target.goalKg}kg</span>
                  </div>
                )}
              </GlassCard>
            </div>
          );
        })
      )}
    </div>
  );
}
