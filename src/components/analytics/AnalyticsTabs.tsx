import Link from "next/link";
import { ANALYTICS_TABS, type AnalyticsTab } from "@/lib/analytics/tabs";
import type { Period } from "@/lib/analytics/periods";

const TAB_LABELS: Record<AnalyticsTab, string> = {
  overview: "Overview",
  train: "Train",
  fuel: "Fuel",
  recovery: "Recovery",
};

/** Fitonist-style pill tab bar. Link-based (URL param) so the page stays a
 * cached server render — same pattern as PeriodSelector, sliding thumb
 * positioned by active index. */
export function AnalyticsTabs({ tab, period, offset }: { tab: AnalyticsTab; period: Period; offset: number }) {
  return (
    <div
      className="flex p-1 gap-0.5 rounded-full bg-white/[0.06] border border-[var(--rtd-hairline)] w-full max-w-[440px]"
      role="tablist"
      aria-label="Analytics sections"
    >
      {/* Active tab styles itself (rtd-pill-active) instead of a sibling
          sliding thumb -- see the class comment in globals.css. */}
      {ANALYTICS_TABS.map((t) => (
        <Link
          key={t}
          href={`/analytics?tab=${t}&period=${period}&offset=${offset}`}
          role="tab"
          aria-selected={t === tab}
          className={`flex-1 min-h-11 px-1 rounded-full text-footnote sm:text-subhead font-medium cursor-pointer transition-colors duration-200 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 flex items-center justify-center ${t === tab ? "rtd-pill-active" : ""}`}
          style={{ color: t === tab ? "#fff" : "var(--rtd-text-secondary)" }}
        >
          {TAB_LABELS[t]}
        </Link>
      ))}
    </div>
  );
}
