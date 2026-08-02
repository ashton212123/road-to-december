import { unstable_cache } from "next/cache";
import { getAnalyticsPageDataRaw, type AnalyticsPageData } from "@/lib/db/analyticsQuery";
import { withRetry } from "@/lib/db/withRetry";
import { withFallback } from "@/lib/db/withFallback";

// Same batch + tag + key (see analytics/page.tsx) as Analytics: one cached
// round trip feeds both pages, and every log write revalidates it
// (swim/actions.ts's updateTag("analytics-data")). Deliberately no
// `revalidate` -- matches analytics/page.tsx's config for this exact key
// exactly; two unstable_cache definitions sharing one key with different
// options is its own bug, not something to introduce here.
const getCachedAnalyticsData = unstable_cache(async (sinceISO: string) => getAnalyticsPageDataRaw(sinceISO), ["analytics-page-data-v4"], {
  tags: ["analytics-data"],
});

// Matches what a fresh install (or a starved query) would see -- every
// downstream .map/.filter/.reduce in viewModel.ts already handles empty
// arrays; settingsRow is never read by the swim view model.
const EMPTY_ANALYTICS_DATA: AnalyticsPageData = {
  mainLiftLogs: [],
  weighIns: [],
  cmjTests: [],
  jumpTestsRaw: [],
  swimTimes: [],
  timeTo15m: [],
  meetsWithEvents: [],
  swimSessions: [],
  sessionLoads: [],
  foodLogs: [],
  sleepLogs: [],
  sorenessLogs: [],
  waterLogs: [],
  settingsRow: null,
};

// WS4 §4c: this page had no withFallback around its one query -- a
// connection hiccup threw all the way to the blank SSR error boundary
// instead of degrading, and withRetry's own worst-case (3 attempts x 15s +
// backoff ~=46s) comfortably exceeded what any real client would wait for.
// Same withFallback(withRetry(...), fallback) composition as every other
// query in this codebase (WS3d/WS4).
export async function getSwimPageData(sinceISO: string) {
  return withFallback(withRetry(() => getCachedAnalyticsData(sinceISO), { timeoutMs: 15000, label: "Swim page data" }), EMPTY_ANALYTICS_DATA);
}
