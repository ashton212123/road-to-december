import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";
import { SwimSection } from "@/components/analytics/SwimSection";
import { SwimWeeklyVolumeCard, SwimMonthDotsCard, SwimLatestSessionCard } from "@/components/analytics/SwimTrainingBlock";
import { getAnalyticsPageDataRaw } from "@/lib/db/analyticsQuery";
import { buildSwimViewModel } from "@/lib/swim/viewModel";
import { withRetry } from "@/lib/db/withRetry";
import { todayManilaISO, addDaysISO } from "@/lib/time";
import { seasonData } from "@/lib/data/season-data";

// Same batch + tag as Analytics: one cached round trip feeds both pages, and
// every log write revalidates it.
const getCachedData = unstable_cache(async (sinceISO: string) => getAnalyticsPageDataRaw(sinceISO), ["analytics-page-data"], {
  tags: ["analytics-data"],
});

export default function SwimPage() {
  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1">
      <SectionLabel>Swim</SectionLabel>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <SwimContent />
      </Suspense>
    </div>
  );
}

async function SwimContent() {
  const today = todayManilaISO();
  const raw = await withRetry(() => getCachedData(addDaysISO(today, -180)), { timeoutMs: 15000 });
  const vm = buildSwimViewModel(raw, today);
  const monthStartISO = `${today.slice(0, 7)}-01`;

  return (
    <div className="flex flex-col gap-4">
      {vm.takeaway && <p className="rtd-glass px-4 py-3 text-subhead text-[var(--rtd-text)] leading-snug">{vm.takeaway}</p>}
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
      <SwimSection
        pbRows={seasonData.PB_ROWS}
        targets={seasonData.TARGETS}
        splitBars={seasonData.SPLIT_BARS}
        splitAutopsy={vm.splitAutopsy}
        timeTo15m={raw.timeTo15m.map((t) => ({ date: t.date, seconds: Number(t.seconds), condition: t.condition }))}
        recentTimes={raw.swimTimes.slice(0, 50).map((t) => ({ id: t.id, date: t.date, event: t.event, timeMs: t.timeMs, meetName: t.meetName }))}
        allSwimTimesByEvent={vm.allSwimTimesByEvent}
        meets={vm.meetsWithReadiness}
        latestTimeByEvent={vm.latestTimeByEvent}
        swimSessions={raw.swimSessions.map((s) => ({
          id: s.id,
          date: s.date,
          loadRating: s.loadRating,
          setsText: s.setsText,
          parsedDistanceM: s.parsedDistanceM,
        }))}
        paceSeries={vm.paceSeries}
        paceTakeaway={vm.paceTakeaway}
      />
    </div>
  );
}
