/** Shown while AnalyticsContent's cached data promise resolves -- lets the
 * page shell (header, period selector) paint instantly on navigation
 * instead of the whole route blocking on the DB round trip. */
export function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="rtd-glass h-40 w-full" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rtd-glass h-56 w-full" />
        <div className="rtd-glass h-56 w-full" />
        <div className="rtd-glass h-56 w-full" />
        <div className="rtd-glass h-56 w-full" />
      </div>
    </div>
  );
}
