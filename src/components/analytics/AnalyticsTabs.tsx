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
  const index = ANALYTICS_TABS.indexOf(tab);
  const n = ANALYTICS_TABS.length;
  return (
    <div
      className="relative flex p-1 gap-0.5 rounded-full bg-white/[0.06] border border-[var(--rtd-hairline)] w-full max-w-[440px]"
      role="tablist"
      aria-label="Analytics sections"
    >
      <div
        aria-hidden="true"
        className="absolute top-1 bottom-1 rounded-full bg-white transition-[left] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ left: `calc(${(index * 100) / n}% + 4px)`, width: `calc(${100 / n}% - 8px)` }}
      />
      {ANALYTICS_TABS.map((t) => (
        <Link
          key={t}
          href={`/analytics?tab=${t}&period=${period}&offset=${offset}`}
          role="tab"
          aria-selected={t === tab}
          className="relative z-10 flex-1 min-h-11 px-1 rounded-full text-footnote sm:text-subhead font-medium cursor-pointer transition-colors duration-200 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 flex items-center justify-center"
          style={{ color: t === tab ? "#0b0b0d" : "var(--rtd-text-secondary)" }}
        >
          {TAB_LABELS[t]}
        </Link>
      ))}
    </div>
  );
}
