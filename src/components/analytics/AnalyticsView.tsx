import Link from "next/link";
import { StrengthSection } from "./StrengthSection";
import { LoadSection } from "./LoadSection";
import { PowerSection } from "./PowerSection";
import { BodyweightSection } from "./BodyweightSection";
import { SwimSection } from "./SwimSection";
import { PeriodSelector } from "./PeriodSelector";
import { ImprovementMatrix } from "./ImprovementMatrix";
import { FuelAdherenceCard } from "./FuelAdherenceCard";
import { RecoveryOverlayCard } from "./RecoveryOverlayCard";
import { AnalyticsTabs } from "./AnalyticsTabs";
import { SwimWeeklyVolumeCard, SwimMonthDotsCard, SwimLatestSessionCard, type SwimWeek } from "./SwimTrainingBlock";
import { MiniBarList } from "@/components/ui/MiniBarList";
import type { TonnageRow, HardSetRow } from "@/lib/analytics/tonnage";
import type { DailySessionLoad, AcwrPoint } from "@/lib/analytics/load";
import type { SeedPbRow, SeedTarget, SeedSplitBar } from "@/lib/data/types";
import type { Period } from "@/lib/analytics/periods";
import type { MatrixRow } from "@/lib/analytics/improvementMatrix";
import type { PacePoint } from "@/lib/swim/pace";
import type { AnalyticsTab } from "@/lib/analytics/tabs";
import type { SwimSessionInterval } from "@/lib/db/schema";

export function AnalyticsView(props: {
  today: string;
  tab: AnalyticsTab;
  period: Period;
  offset: number;
  currentPeriodLabel: string;
  swimWeekly: SwimWeek[];
  monthStartISO: string;
  latestSwimSession: {
    date: string;
    parsedDistanceM: number | null;
    setsText: string | null;
    intervals: SwimSessionInterval[] | null;
  } | null;
  matrixRows: MatrixRow[];
  takeaways: Record<"strength" | "load" | "power" | "bodyweight" | "swim", string | null>;
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
  pbRows: SeedPbRow[];
  targets: SeedTarget[];
  splitBars: SeedSplitBar[];
  splitAutopsy: { date: string; splits: number[]; strokeCounts: number[] }[];
  timeTo15m: { date: string; seconds: number; condition: string }[];
  recentSwimTimes: { id: number; date: string; event: string; timeMs: number; meetName: string | null }[];
  allSwimTimesByEvent: Record<string, { date: string; timeMs: number }[]>;
  meets: {
    id: number;
    name: string;
    date: string;
    events: {
      id: number;
      event: string;
      currentTimeMs: number | null;
      targetTimeMs: number;
      readiness: import("@/lib/swim/readiness").ReadinessResult;
    }[];
  }[];
  latestTimeByEvent: Record<string, number>;
  swimSessions: { id: number; date: string; loadRating: number; setsText: string | null; parsedDistanceM: number | null }[];
  paceSeries: PacePoint[];
  paceTakeaway: string | null;
  sorenessLogs: { id: number; date: string; area: string; rating1to5: number }[];
  sleepLogs: { date: string; hours: number }[];
  foodAdherenceByDate: { date: string; kcal: number; kcalTargetMin: number }[];
}) {
  const overviewDomains: { tab: AnalyticsTab; label: string; takeaway: string | null }[] = [
    { tab: "train", label: "Train", takeaway: props.takeaways.strength ?? props.takeaways.load },
    { tab: "swim", label: "Swim", takeaway: props.takeaways.swim },
    { tab: "fuel", label: "Fuel", takeaway: props.takeaways.bodyweight },
    { tab: "recovery", label: "Recovery", takeaway: props.takeaways.power },
  ];

  return (
    <div className="flex flex-col gap-4">
      <AnalyticsTabs tab={props.tab} period={props.period} offset={props.offset} />
      <PeriodSelector period={props.period} offset={props.offset} currentLabel={props.currentPeriodLabel} tab={props.tab} />

      {props.tab === "overview" && (
        <>
          <ImprovementMatrix rows={props.matrixRows} period={props.period} offset={props.offset} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {overviewDomains.map((d) => (
              <Link
                key={d.tab}
                href={`/analytics?tab=${d.tab}&period=${props.period}&offset=${props.offset}`}
                className="rtd-glass px-4 py-3 flex flex-col gap-1 cursor-pointer hover:bg-white/[0.05] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
              >
                <div className="flex items-center justify-between">
                  <span className="rtd-micro-label">{d.label}</span>
                  <span className="text-[var(--rtd-text-tertiary)]" aria-hidden="true">
                    ›
                  </span>
                </div>
                <span className="text-subhead text-[var(--rtd-text)] leading-snug">
                  {d.takeaway ?? "No takeaway yet — log a few sessions."}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {props.tab === "train" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div id="detail-strength" className="flex flex-col gap-2">
            {props.takeaways.strength && (
              <p className="rtd-glass px-4 py-3 text-subhead text-[var(--rtd-text)] leading-snug">{props.takeaways.strength}</p>
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
              <p className="rtd-glass px-4 py-3 text-subhead text-[var(--rtd-text)] leading-snug">{props.takeaways.load}</p>
            )}
            {props.tonnage.length > 0 && (
              <div className="rtd-glass px-4 py-3 flex flex-col gap-2">
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
              <p className="rtd-glass px-4 py-3 text-subhead text-[var(--rtd-text)] leading-snug">{props.takeaways.power}</p>
            )}
            <PowerSection cmjSeries={props.cmjSeries} broadJumpSeries={props.broadJumpSeries} />
          </div>
        </div>
      )}

      {props.tab === "swim" && (
        <>
          {props.takeaways.swim && (
            <p className="rtd-glass px-4 py-3 text-subhead text-[var(--rtd-text)] leading-snug">{props.takeaways.swim}</p>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <SwimWeeklyVolumeCard weeks={props.swimWeekly} />
            <SwimMonthDotsCard monthStartISO={props.monthStartISO} today={props.today} sessions={props.swimSessions} />
          </div>
          <SwimLatestSessionCard session={props.latestSwimSession} />
          <div id="detail-swim">
            <SwimSection
              pbRows={props.pbRows}
              targets={props.targets}
              splitBars={props.splitBars}
              splitAutopsy={props.splitAutopsy}
              timeTo15m={props.timeTo15m}
              recentTimes={props.recentSwimTimes}
              allSwimTimesByEvent={props.allSwimTimesByEvent}
              meets={props.meets}
              latestTimeByEvent={props.latestTimeByEvent}
              swimSessions={props.swimSessions}
              paceSeries={props.paceSeries}
              paceTakeaway={props.paceTakeaway}
            />
          </div>
        </>
      )}

      {props.tab === "fuel" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div id="detail-fuel" className="flex flex-col gap-2">
            <FuelAdherenceCard days={props.foodAdherenceByDate} />
          </div>
          <div id="detail-body" className="flex flex-col gap-2">
            {props.takeaways.bodyweight && (
              <p className="rtd-glass px-4 py-3 text-subhead text-[var(--rtd-text)] leading-snug">{props.takeaways.bodyweight}</p>
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
