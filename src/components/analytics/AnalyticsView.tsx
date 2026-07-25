import dynamic from "next/dynamic";
import { StrengthSection } from "./StrengthSection";
import { PeriodSelector } from "./PeriodSelector";
import { ImprovementMatrix } from "./ImprovementMatrix";
import { FuelAdherenceCard } from "./FuelAdherenceCard";
import { RecoveryOverlayCard } from "./RecoveryOverlayCard";
import { AnalyticsTabs } from "./AnalyticsTabs";
import { OverviewTile } from "./OverviewTile";
import { MiniBarList } from "@/components/ui/MiniBarList";
import type { TonnageRow, HardSetRow } from "@/lib/analytics/tonnage";
import type { DailySessionLoad, AcwrPoint } from "@/lib/analytics/load";
import type { Period } from "@/lib/analytics/periods";
import type { MatrixRow } from "@/lib/analytics/improvementMatrix";
import type { AnalyticsTab } from "@/lib/analytics/tabs";

// recharts is a heavy dependency only these three sections need -- code-split
// so the Overview tab (matrix + takeaway cards, zero charts) doesn't ship it.
// SSR stays on (no ssr:false): the win is the separate chunk only loading
// when the section actually renders, not skipping server rendering.
const chartFallback = <div className="rtd-glass" style={{ height: 220 }} />;
const LoadSection = dynamic(() => import("./LoadSection").then((m) => m.LoadSection), { loading: () => chartFallback });
const PowerSection = dynamic(() => import("./PowerSection").then((m) => m.PowerSection), { loading: () => chartFallback });
const BodyweightSection = dynamic(() => import("./BodyweightSection").then((m) => m.BodyweightSection), { loading: () => chartFallback });

export function AnalyticsView(props: {
  today: string;
  tab: AnalyticsTab;
  period: Period;
  offset: number;
  currentPeriodLabel: string;
  matrixRows: MatrixRow[];
  takeaways: Record<"strength" | "load" | "power" | "bodyweight" | "swim", string | null>;
  overviewTiles: { href: string; label: string; domainColor: string; headline: string; sparkline: number[]; takeaway: string | null }[];
  e1rmByLift: Record<string, { date: string; e1rm: number }[]>;
  liftTargets: Record<string, { label: string; goalKg: number }>;
  tonnage: TonnageRow[];
  hardSets: HardSetRow[];
  dailyLoads: DailySessionLoad[];
  acwr: AcwrPoint[];
  weeklySessions: { weekStart: string; count: number }[];
  cmjSeries: { date: string; cm: number }[];
  broadJumpSeries: { date: string; cm: number }[];
  weightSeries: { date: string; kg: number; avg7: number }[];
  sorenessLogs: { id: number; date: string; area: string; rating1to5: number }[];
  sleepLogs: { date: string; hours: number }[];
  foodAdherenceByDate: { date: string; kcal: number; kcalTargetMin: number }[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <AnalyticsTabs tab={props.tab} period={props.period} offset={props.offset} />
      <PeriodSelector period={props.period} offset={props.offset} currentLabel={props.currentPeriodLabel} tab={props.tab} />

      {props.tab === "overview" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {props.overviewTiles.map((t) => (
              <OverviewTile key={t.label} {...t} />
            ))}
          </div>
          <ImprovementMatrix rows={props.matrixRows} period={props.period} offset={props.offset} />
        </>
      )}

      {props.tab === "train" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div id="detail-strength" className="flex flex-col gap-2">
            {props.takeaways.strength && (
              <p className="rtd-open-section text-subhead text-[var(--rtd-text)] leading-snug">{props.takeaways.strength}</p>
            )}
            <StrengthSection
              e1rmByLift={props.e1rmByLift}
              liftTargets={props.liftTargets}
              today={props.today}
              period={props.period}
              offset={props.offset}
            />
          </div>

          <div id="detail-load" className="flex flex-col gap-2">
            {props.takeaways.load && (
              <p className="rtd-open-section text-subhead text-[var(--rtd-text)] leading-snug">{props.takeaways.load}</p>
            )}
            {props.tonnage.length > 0 && (
              <div className="rtd-open-section flex flex-col gap-2">
                <div className="rtd-micro-label">Tonnage by movement pattern (this week)</div>
                <MiniBarList
                  color="var(--rtd-domain-train)"
                  formatValue={(v) => `${Math.round(v)}kg`}
                  rows={(["squat", "hinge", "press", "pull"] as const)
                    .map((pattern) => ({
                      label: pattern.charAt(0).toUpperCase() + pattern.slice(1),
                      value: props.tonnage[props.tonnage.length - 1][pattern],
                    }))
                    .filter((r) => r.value > 0)}
                />
              </div>
            )}
            <LoadSection
              dailyLoads={props.dailyLoads}
              acwr={props.acwr}
              tonnage={props.tonnage}
              hardSets={props.hardSets}
              weeklySessions={props.weeklySessions}
              today={props.today}
              period={props.period}
              offset={props.offset}
            />
          </div>

          <div id="detail-power" className="flex flex-col gap-2">
            {props.takeaways.power && (
              <p className="rtd-open-section text-subhead text-[var(--rtd-text)] leading-snug">{props.takeaways.power}</p>
            )}
            <PowerSection cmjSeries={props.cmjSeries} broadJumpSeries={props.broadJumpSeries} />
          </div>
        </div>
      )}

      {props.tab === "fuel" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div id="detail-fuel" className="flex flex-col gap-2">
            <FuelAdherenceCard days={props.foodAdherenceByDate} />
          </div>
          <div id="detail-body" className="flex flex-col gap-2">
            {props.takeaways.bodyweight && (
              <p className="rtd-open-section text-subhead text-[var(--rtd-text)] leading-snug">{props.takeaways.bodyweight}</p>
            )}
            <BodyweightSection weightSeries={props.weightSeries} today={props.today} period={props.period} offset={props.offset} />
          </div>
        </div>
      )}

      {props.tab === "recovery" && (
        <div id="detail-recovery" className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <RecoveryOverlayCard
            sleepLogs={props.sleepLogs}
            cmjSeries={props.cmjSeries}
            sorenessLogs={props.sorenessLogs}
            today={props.today}
            period={props.period}
            offset={props.offset}
          />
        </div>
      )}
    </div>
  );
}
