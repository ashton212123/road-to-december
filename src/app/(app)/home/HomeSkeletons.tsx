import clsx from "clsx";

/** Miles OS skeleton block: panel background, 6px radius, a pulse toward
 * --rtd-mos-panel-2 (not a shimmer sweep -- CSS in globals.css). Reduced-motion
 * users get the global blanket override, no per-component handling needed. */
function Block({ height, className }: { height: number | string; className?: string }) {
  return <div className={clsx("rtd-mos-skeleton", className)} style={{ height }} />;
}

export function CoachBriefSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Block height={14} className="w-28" />
      <Block height={230} className="w-full" />
    </div>
  );
}

/** Mirrors HomeMainContent's real layout shape (hero band, doorway dials,
 * 3-column Miles OS grid) so the swap-in causes as little reflow as
 * possible. Heights are close approximations of the real panels' rendered
 * height, not pixel-measured. */
export function HomeMainSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 md:gap-3">
      <div className="flex items-center justify-between">
        <Block height={24} className="w-16 md:hidden" />
        <div className="flex items-center gap-2 ml-auto">
          <Block height={32} className="w-[92px]" />
          <Block height={32} className="w-8 md:hidden" />
        </div>
      </div>
      <Block height={220} className="w-full" />
      <div className="grid grid-cols-3 gap-2">
        <Block height={96} />
        <Block height={96} />
        <Block height={96} />
      </div>

      <div className="rtd-mos-grid">
        <div className="rtd-mos-col">
          <Block height={150} />
          <Block height={190} />
          <Block height={170} />
          <Block height={230} />
        </div>

        <div className="rtd-mos-col">
          <Block height={280} />
          <Block height={200} />
          <Block height={220} />
          <CoachBriefSkeleton />
          <Block height={300} />
        </div>

        <div className="rtd-mos-col">
          <Block height={190} />
          <Block height={150} />
          <Block height={40} className="lg:hidden" />
          <div className="hidden lg:flex lg:flex-col gap-3.5">
            <Block height={150} />
            <Block height={140} />
            <Block height={130} />
          </div>
        </div>
      </div>
    </div>
  );
}
