import { Suspense } from "react";
import { todayManilaISO } from "@/lib/time";
import { HeaderActions, HomeMainContent } from "./HomeSections";
import { HeaderActionsSkeleton, HomeMainSkeleton } from "./HomeSkeletons";

// Home used to be one giant async function: four sequential awaits (canvas
// sync, a 19-query Promise.all, evaluateAlerts, dailyBrief) before a single
// byte of HTML left the server -- on the tiny 3-connection pool this read as
// a hang on phones. This component itself now does no awaiting at all: the
// header/nav/grid shell returns synchronously and every data-dependent
// region streams in through its own Suspense boundary below (see
// HomeSections.tsx / data.ts for the boundary split and the cache()-memoized
// view model that keeps them from tripling the underlying query).
export default function HomePage() {
  const today = todayManilaISO();

  return (
    <div className="flex flex-col gap-2.5 md:gap-3 pt-1">
      <div className="flex items-center justify-between">
        <span className="text-title-3 font-semibold text-[var(--rtd-text)] md:hidden">Home</span>
        <Suspense fallback={<HeaderActionsSkeleton />}>
          <HeaderActions today={today} />
        </Suspense>
      </div>

      <Suspense fallback={<HomeMainSkeleton />}>
        <HomeMainContent today={today} />
      </Suspense>
    </div>
  );
}
