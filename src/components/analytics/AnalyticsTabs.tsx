import Link from "next/link";
import { ANALYTICS_TABS, type AnalyticsTab } from "@/lib/analytics/tabs";
import type { Period } from "@/lib/analytics/periods";
import { SlidingPillNav } from "@/components/ui/SlidingPillNav";

const TAB_LABELS: Record<AnalyticsTab, string> = {
  overview: "Overview",
  train: "Train",
  fuel: "Fuel",
  recovery: "Recovery",
};

/** Fitonist-style pill tab bar. Link-based (URL param) so the page stays a
 * cached server render — SlidingPillNav's thumb is the only client state,
 * positioned by measuring the active Link, not an index formula. */
export function AnalyticsTabs({ tab, period, offset }: { tab: AnalyticsTab; period: Period; offset: number }) {
  return (
    <SlidingPillNav
      activeKey={tab}
      role="tablist"
      aria-label="Analytics sections"
      className="flex p-1 gap-0.5 rounded-full bg-white/[0.06] border border-[var(--rtd-hairline)] w-full max-w-[440px]"
    >
      {ANALYTICS_TABS.map((t) => (
        <Link
          key={t}
          href={`/analytics?tab=${t}&period=${period}&offset=${offset}`}
          role="tab"
          aria-selected={t === tab}
          data-pill-key={t}
          className="relative z-10 flex-1 min-h-11 px-1 rounded-full text-footnote sm:text-subhead font-medium cursor-pointer transition-colors duration-200 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 flex items-center justify-center"
          style={{ color: t === tab ? "#fff" : "var(--rtd-text-secondary)" }}
        >
          {TAB_LABELS[t]}
        </Link>
      ))}
    </SlidingPillNav>
  );
}
