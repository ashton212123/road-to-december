import { Suspense } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { unstable_cache } from "next/cache";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";
import {
  SwimWeeklyVolumeCard,
  SwimMonthDotsCard,
  SwimLatestSessionCard,
  SwimMeetReadinessCard,
  SwimZoneWeeklyCard,
} from "@/components/analytics/SwimTrainingBlock";
import { SwimLogSheet } from "@/components/swim/SwimLogSheet";
import { SwimViewSelector, type SwimView } from "@/components/analytics/SwimViewSelector";
import { SwimSessionList } from "@/components/analytics/SwimSessionList";
import { SwimHero } from "@/components/analytics/SwimHero";
import { MeetsList } from "@/components/analytics/MeetsList";
import { AddMeetForm } from "@/components/analytics/AddMeetForm";
import { SwimTimeLogger } from "@/components/analytics/SwimTimeLogger";
import { RecentSwimTimesCard } from "@/components/analytics/RecentSwimTimesCard";
import { getAnalyticsPageDataRaw } from "@/lib/db/analyticsQuery";
import { buildSwimViewModel } from "@/lib/swim/viewModel";
import { withRetry } from "@/lib/db/withRetry";
import { todayManilaISO, addDaysISO, daysBetween } from "@/lib/time";
import { seasonData } from "@/lib/data/season-data";
import { analyzeDps, type DpsAnalysis } from "@/lib/swim/dps";
import { buildImSplitModel, type ImSplitModel } from "@/lib/swim/imModel";
import { detectBottlenecks } from "@/lib/swim/bottlenecks";

// The recharts-dependent Analysis view is the only reason this page ever
// needed the chart bundle -- Log and Meets never touch it, so it stays
// deferred behind next/dynamic (SSR kept on) instead of loading eagerly.
const SwimAnalysisView = dynamic(() => import("@/components/analytics/SwimAnalysisView").then((m) => m.SwimAnalysisView), {
  loading: () => <div className="rtd-glass" style={{ height: 220 }} />,
});

// Same batch + tag (and same v2 key, see analytics/page.tsx) as Analytics:
// one cached round trip feeds both pages, and every log write revalidates it.
const getCachedData = unstable_cache(async (sinceISO: string) => getAnalyticsPageDataRaw(sinceISO), ["analytics-page-data-v2"], {
  tags: ["analytics-data"],
});

type Vm = ReturnType<typeof buildSwimViewModel>;

// The most recent IM race (400 IM preferred, falling back to 200 IM) that
// has both logged splits AND a target time on an upcoming meet -- without
// both, there's nothing honest to compare against, so this returns null
// rather than guessing a target.
function buildImModel(vm: Vm): ImSplitModel | null {
  const targetByEvent = new Map(vm.meetsWithReadiness.flatMap((m) => m.events).map((e) => [e.event, e.targetTimeMs]));
  for (const ev of ["400 IM", "200 IM"] as const) {
    const raceData = vm.imRaceSplits[ev];
    const targetTotalMs = targetByEvent.get(ev);
    if (!raceData || !raceData.course || !targetTotalMs) continue;
    return buildImSplitModel({
      event: ev,
      targetTotalMs,
      loggedSplits: raceData.splits.map((s) => Math.round(s * 1000)),
      course: raceData.course,
    });
  }
  return null;
}

export default async function SwimPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: rawView } = await searchParams;
  const view: SwimView = rawView === "meets" || rawView === "analysis" ? rawView : "log";

  return (
    <div className="flex flex-col gap-4 pt-1">
      <SectionLabel>Swim</SectionLabel>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <SwimContent view={view} />
      </Suspense>
    </div>
  );
}

async function SwimContent({ view }: { view: SwimView }) {
  const today = todayManilaISO();
  const raw = await withRetry(() => getCachedData(addDaysISO(today, -180)), { timeoutMs: 15000 });
  const vm = buildSwimViewModel(raw, today);
  const monthStartISO = `${today.slice(0, 7)}-01`;

  const meetEventsFlat = vm.meetsWithReadiness.flatMap((m) =>
    m.events.map((e) => ({ event: e.event, targetTimeMs: e.targetTimeMs, readiness: e.readiness, meetName: m.name, meetDate: m.date, course: m.course }))
  );
  const recentTimes = raw.swimTimes.slice(0, 50).map((t) => ({ id: t.id, date: t.date, event: t.event, timeMs: t.timeMs, meetName: t.meetName }));

  const latestRaceWithSplits = vm.splitAutopsy.find((s) => s.isRace) ?? null;
  let dps: DpsAnalysis | null = null;
  let dpsMissingReason: string | null = null;
  if (!latestRaceWithSplits) {
    dpsMissingReason = "Log a race with per-50 splits and stroke counts to see this.";
  } else if (!latestRaceWithSplits.course) {
    dpsMissingReason = "This race is missing its pool course (SCM/LCM) -- log it to see this.";
  } else {
    dps = analyzeDps({
      event: latestRaceWithSplits.event,
      course: latestRaceWithSplits.course,
      splits: latestRaceWithSplits.splits,
      strokeCounts: latestRaceWithSplits.strokeCounts,
    });
    if (dps.signature === "insufficient-data") dpsMissingReason = dps.interpretation.replace("Not enough data to analyse this swim — ", "");
  }

  const timeTo15m = raw.timeTo15m.map((t) => ({ date: t.date, seconds: Number(t.seconds), condition: t.condition }));
  const nextMeet = vm.meetsWithReadiness.filter((m) => m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null;
  const daysToNextMeet = nextMeet ? daysBetween(today, nextMeet.date) : null;
  const imModel = buildImModel(vm);

  const bottlenecks = detectBottlenecks({
    dps,
    splitAutopsy: vm.splitAutopsy,
    timeTo15m,
    zoneHistory: vm.zoneWeekly,
    criticalSpeed: vm.criticalSpeed,
    imModel,
    breastKickWeeklyM: vm.breastKickWeekly,
    daysToNextMeet,
  });

  return (
    <div className="flex flex-col gap-4">
      {vm.takeaway && <p className="rtd-glass px-4 py-3 text-subhead text-[var(--rtd-text)] leading-snug">{vm.takeaway}</p>}
      <SwimViewSelector current={view} />

      {view === "log" && (
        <div className="flex flex-col gap-4">
          <SwimLogSheet />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <SwimWeeklyVolumeCard weeks={vm.swimWeekly} />
            <SwimMonthDotsCard
              monthStartISO={monthStartISO}
              today={today}
              sessions={raw.swimSessions.map((s) => ({ date: s.date, parsedDistanceM: s.parsedDistanceM }))}
            />
          </div>
          <SwimLatestSessionCard
            session={
              vm.latestSwimSession
                ? {
                    date: vm.latestSwimSession.date,
                    parsedDistanceM: vm.latestSwimSession.parsedDistanceM,
                    setsText: vm.latestSwimSession.setsText,
                    intervals: vm.latestSwimSession.intervals,
                  }
                : null
            }
          />
          <div>
            <SectionLabel
              right={
                <Link href="/swim/sessions" className="text-caption text-[var(--rtd-cyan)] cursor-pointer hover:brightness-110">
                  See all sessions →
                </Link>
              }
            >
              Recent sessions
            </SectionLabel>
            <SwimSessionList
              sessions={raw.swimSessions.map((s) => ({
                id: s.id,
                date: s.date,
                loadRating: s.loadRating,
                setsText: s.setsText,
                parsedDistanceM: s.parsedDistanceM,
                sessionType: s.sessionType,
              }))}
            />
          </div>
          <SwimZoneWeeklyCard weeks={vm.zoneWeekly} />
        </div>
      )}

      {view === "meets" && (
        <div className="flex flex-col gap-4">
          <SwimMeetReadinessCard meets={vm.meetsWithReadiness} today={today} />
          <SwimHero allSwimTimesByEvent={vm.allSwimTimesByEvent} meetEventsFlat={meetEventsFlat} />
          <div>
            <SectionLabel>Meets & targets</SectionLabel>
            <div className="flex flex-col gap-3">
              <MeetsList meets={vm.meetsWithReadiness} />
              <AddMeetForm latestTimeByEvent={vm.latestTimeByEvent} />
            </div>
          </div>
          <div id="log-time">
            <SwimTimeLogger />
          </div>
          <RecentSwimTimesCard recentTimes={recentTimes} />
        </div>
      )}

      {view === "analysis" && (
        <SwimAnalysisView
          pbsByEventAndCourse={vm.pbsByEventAndCourse}
          seedPbRows={seasonData.PB_ROWS}
          targets={seasonData.TARGETS}
          splitAutopsy={vm.splitAutopsy}
          timeTo15m={timeTo15m}
          dps={dps}
          dpsMissingReason={dpsMissingReason}
          bottlenecks={bottlenecks}
        />
      )}
    </div>
  );
}
