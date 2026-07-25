import { Suspense } from "react";
import dynamic from "next/dynamic";
import { unstable_cache } from "next/cache";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";
import {
  SwimWeeklyVolumeCard,
  SwimMonthDotsCard,
  SwimLatestSessionCard,
  SwimMeetReadinessCard,
} from "@/components/analytics/SwimTrainingBlock";
import { SwimLogHero } from "@/components/analytics/SwimLogHero";
import { SwimViewSelector, type SwimView } from "@/components/analytics/SwimViewSelector";
import { SwimSessionList } from "@/components/analytics/SwimSessionList";
import { SwimHero } from "@/components/analytics/SwimHero";
import { MeetsList } from "@/components/analytics/MeetsList";
import { AddMeetForm } from "@/components/analytics/AddMeetForm";
import { SwimTimeLogger } from "@/components/analytics/SwimTimeLogger";
import { RecentSwimTimesCard } from "@/components/analytics/RecentSwimTimesCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { ComparisonLine } from "@/components/ui/ComparisonLine";
import { getAnalyticsPageDataRaw } from "@/lib/db/analyticsQuery";
import { buildSwimViewModel } from "@/lib/swim/viewModel";
import { withRetry } from "@/lib/db/withRetry";
import { todayManilaISO, addDaysISO } from "@/lib/time";
import { seasonData } from "@/lib/data/season-data";

// The recharts-dependent Analysis view is the only reason this page ever
// needed the chart bundle -- Log and Meets never touch it, so it stays
// deferred behind next/dynamic (SSR kept on) instead of loading eagerly.
const SwimAnalysisView = dynamic(() => import("@/components/analytics/SwimAnalysisView").then((m) => m.SwimAnalysisView), {
  loading: () => <div className="rtd-glass" style={{ height: 220 }} />,
});

// Same batch + tag as Analytics: one cached round trip feeds both pages, and
// every log write revalidates it.
const getCachedData = unstable_cache(async (sinceISO: string) => getAnalyticsPageDataRaw(sinceISO), ["analytics-page-data"], {
  tags: ["analytics-data"],
});

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
    m.events.map((e) => ({ event: e.event, targetTimeMs: e.targetTimeMs, readiness: e.readiness, meetName: m.name, meetDate: m.date }))
  );
  const recentTimes = raw.swimTimes.slice(0, 50).map((t) => ({ id: t.id, date: t.date, event: t.event, timeMs: t.timeMs, meetName: t.meetName }));

  return (
    <div className="flex flex-col gap-4">
      {vm.takeaway && <p className="rtd-glass px-4 py-3 text-subhead text-[var(--rtd-text)] leading-snug">{vm.takeaway}</p>}
      <SwimViewSelector current={view} />

      {view === "log" && (
        <div className="flex flex-col gap-4">
          <SwimLogHero />
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
          <SwimSessionList
            sessions={raw.swimSessions.map((s) => ({
              id: s.id,
              date: s.date,
              loadRating: s.loadRating,
              setsText: s.setsText,
              parsedDistanceM: s.parsedDistanceM,
            }))}
          />
          {vm.paceSeries.length > 0 && (
            <div>
              <SectionLabel>Pace per 100 (from imported sessions)</SectionLabel>
              <GlassCard variant="open" className="flex flex-col gap-2">
                {vm.paceTakeaway && <p className="text-caption text-[var(--rtd-text-secondary)]">{vm.paceTakeaway}</p>}
                <ComparisonLine
                  current={vm.paceSeries.map((p) => p.paceSecPer100)}
                  previous={vm.paceSeries.map(() => null)}
                  color="var(--rtd-cyan)"
                  height={100}
                  labels={vm.paceSeries.map((p) => p.date.slice(5))}
                />
              </GlassCard>
            </div>
          )}
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
          pbRows={seasonData.PB_ROWS}
          targets={seasonData.TARGETS}
          splitBars={seasonData.SPLIT_BARS}
          splitAutopsy={vm.splitAutopsy}
          timeTo15m={raw.timeTo15m.map((t) => ({ date: t.date, seconds: Number(t.seconds), condition: t.condition }))}
        />
      )}
    </div>
  );
}
