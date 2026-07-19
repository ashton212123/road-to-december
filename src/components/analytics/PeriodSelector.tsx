import Link from "next/link";
import type { Period } from "@/lib/analytics/periods";

export function PeriodSelector({ period, offset, currentLabel }: { period: Period; offset: number; currentLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex p-1 gap-1 rounded-full bg-white/[0.06] border border-[var(--rtd-hairline)]" role="tablist">
        {(["week", "month"] as Period[]).map((p) => (
          <Link
            key={p}
            href={`/analytics?period=${p}&offset=0`}
            role="tab"
            aria-selected={p === period}
            className="rtd-segmented-btn min-h-11 px-4 py-1.5 rounded-full text-subhead font-medium cursor-pointer transition-[background-color,transform] duration-200 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 flex items-center"
            data-active={p === period}
            style={{ color: p === period ? "#fff" : "var(--rtd-text-secondary)" }}
          >
            {p === "week" ? "Week" : "Month"}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <Link
          href={`/analytics?period=${period}&offset=${offset + 1}`}
          aria-label="Previous period"
          className="rtd-tap-target w-7 h-7 flex items-center justify-center rounded-full text-[var(--rtd-text-secondary)] cursor-pointer hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
        >
          ‹
        </Link>
        <span className="text-footnote font-medium text-[var(--rtd-text-secondary)] min-w-[110px] text-center">{currentLabel}</span>
        {offset > 0 ? (
          <Link
            href={`/analytics?period=${period}&offset=${offset - 1}`}
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
