import clsx from "clsx";

function Block({ height, className }: { height: number | string; className?: string }) {
  return <div className={clsx("rtd-mos-skeleton", className)} style={{ height }} />;
}

/** Mirrors SwimSessionsContent's real layout (a zone bar + header row, then
 * a panel of session rows, repeated per week) so the swap-in causes minimal
 * reflow. Heights are close approximations, not pixel-measured. */
export function SwimSessionsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <Block height={14} className="w-32" />
              <Block height={12} className="w-24" />
            </div>
            <Block height={6} className="w-full" />
          </div>
          <Block height={140} className="w-full" />
        </div>
      ))}
    </div>
  );
}
