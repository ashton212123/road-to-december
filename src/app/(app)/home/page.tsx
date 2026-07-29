import { Suspense } from "react";
import { todayManilaISO } from "@/lib/time";
import { HomeMainContent } from "./HomeSections";
import { HomeMainSkeleton } from "./HomeSkeletons";

// Home used to be one giant async function: four sequential awaits (canvas
// sync, a 19-query Promise.all, evaluateAlerts, dailyBrief) before a single
// byte of HTML left the server -- on the tiny 3-connection pool this read as
// a hang on phones. This component itself now does no awaiting at all: it
// returns the flex shell synchronously and the single data-dependent region
// below streams in through one Suspense boundary (see HomeSections.tsx /
// data.ts for the cached view model and the separate dailyBrief boundary
// nested inside it).
export default function HomePage() {
  const today = todayManilaISO();

  return (
    <div className="flex flex-col gap-2.5 md:gap-3 pt-1">
      <Suspense fallback={<HomeMainSkeleton />}>
        <HomeMainContent today={today} />
      </Suspense>
    </div>
  );
}
