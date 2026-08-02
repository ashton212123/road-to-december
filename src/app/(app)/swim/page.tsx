import { Suspense } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { AnalyticsSkeleton } from "@/components/analytics/AnalyticsSkeleton";
import type { SwimView } from "@/components/analytics/SwimViewSelector";
import { SwimContent } from "./SwimSections";

// WS4 §4c: page.tsx does no data awaits at all -- SwimContent (SwimSections.tsx)
// does the one data-dependent fetch (data.ts, now withFallback-guarded) behind
// this single Suspense boundary, same convention as home/page.tsx.
export default async function SwimPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: rawView } = await searchParams;
  const view: SwimView = rawView === "meets" || rawView === "analysis" ? rawView : "log";

  return (
    <div className="flex flex-col gap-4 pt-1">
      <SectionHeader title="Swim" className="mb-2" />
      <Suspense fallback={<AnalyticsSkeleton />}>
        <SwimContent view={view} />
      </Suspense>
    </div>
  );
}
