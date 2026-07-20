import Link from "next/link";
import type { Period } from "@/lib/analytics/periods";
import type { AnalyticsTab } from "@/lib/analytics/tabs";

export function PeriodSelector({
  period,
  offset,
  currentLabel,
  tab = "overview",
}: {
  period: Period;
  offset: number;
  currentLabel: string;
  tab?: AnalyticsTab;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="relative flex p-1 gap-1 rounded-full bg-white/[0.06] border border-[var(--rtd-hairline)] w-[152px]" role="tablist">
        <div
          aria-hidden="true"
          className="absolute top-1 bottom-1 rounded-full bg-white/[0.12] border border-[var(--rtd-hairline)] transition-[left] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ left: period === "week" ? "4px" : "calc(50% + 0px)", width: "calc(50% - 8px)" }}
        />
        {(["week", "month"] as Period[]).map((p) => (
          <Link
            key={p}
            href={`/analytics?tab=${tab}&period=${p}&offset=0`}
            role="tab"
            aria-selected={p === period}
            className="relative z-10 flex-1 min-h-11 px-4 py-1.5 rounded-full text-subhead font-medium cursor-pointer transition-colors duration-200 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 flex items-center justify-center"
            style={{ color: p === period ? "#fff" : "var(--rtd-text-secondary)" }}
          >
            {p === "week" ? "Week" : "Month"}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={`/analytics?tab=${tab}&period=${period}&offset=${offset + 1}`}
          aria-label="Previous period"
          className="rtd-tap-target w-7 h-7 flex items-center justify-center rounded-full text-[var(--rtd-text-secondary)] cursor-pointer hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
        >
          ‹
        </Link>
        <span className="text-footnote font-medium text-[var(--rtd-text-secondary)] min-w-[110px] text-center">{currentLabel}</span>
        {offset > 0 ? (
          <Link
            href={`/analytics?tab=${tab}&period=${period}&offset=${offset - 1}`}
            aria-label="Next period"
            className="rtd-tap-target w-7 h-7 flex items-center justify-center rounded-full text-[var(--rtd-text-secondary)] cursor-pointer hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            ›
          </Link>
        ) : (
          <span className="w-7 h-7 flex items-center justify-center text-[var(--rtd-text-tertiary)] opacity-30">›</span>
        )}
      </div>
    </div>
  );
}
