"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { StrengthSection } from "./StrengthSection";
import { LoadSection } from "./LoadSection";
import { PowerSection } from "./PowerSection";
import { BodyweightSection } from "./BodyweightSection";
import { SwimSection } from "./SwimSection";
import type { TonnageRow, HardSetRow } from "@/lib/analytics/tonnage";
import type { DailySessionLoad, AcwrPoint } from "@/lib/analytics/load";
import type { SeedPbRow, SeedTarget, SeedSplitBar } from "@/lib/data/types";

type Tab = "strength" | "load" | "power" | "bodyweight" | "swim";

export function AnalyticsView(props: {
  e1rmByLift: Record<string, { date: string; e1rm: number }[]>;
  liftTargets: Record<string, { label: string; goalKg: number }>;
  tonnage: TonnageRow[];
  hardSets: HardSetRow[];
  dailyLoads: DailySessionLoad[];
  acwr: AcwrPoint[];
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
}) {
  const [tab, setTab] = useState<Tab>("strength");

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "strength", label: "Strength" },
          { value: "load", label: "Load" },
          { value: "power", label: "Power" },
          { value: "bodyweight", label: "Weight" },
          { value: "swim", label: "Swim" },
        ]}
      />
      {tab === "strength" && (
        <StrengthSection e1rmByLift={props.e1rmByLift} liftTargets={props.liftTargets} tonnage={props.tonnage} hardSets={props.hardSets} />
      )}
      {tab === "load" && <LoadSection dailyLoads={props.dailyLoads} acwr={props.acwr} />}
      {tab === "power" && <PowerSection cmjSeries={props.cmjSeries} broadJumpSeries={props.broadJumpSeries} />}
      {tab === "bodyweight" && <BodyweightSection weightSeries={props.weightSeries} />}
      {tab === "swim" && (
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
        />
      )}
    </div>
  );
}
