import Link from "next/link";
import { SlidingPillNav } from "@/components/ui/SlidingPillNav";
import { SESSION_TYPES, TYPE_LABELS } from "@/lib/swim/sessionType";

const OPTIONS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  ...SESSION_TYPES.map((t) => ({ key: t, label: TYPE_LABELS[t].replace(" session", "") })),
];

/** URL-param driven, same Link-push pattern as AnalyticsTabs/PeriodSelector
 * -- reuses SlidingPillNav directly rather than a new selector, wrapped in a
 * horizontal-scroll strip since 9 session-type pills don't fit flex-1 on a
 * phone width the way a 2-4 option SegmentedControl does. */
export function SwimSessionTypeFilter({ current }: { current: string }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <SlidingPillNav
        activeKey={current}
        role="tablist"
        aria-label="Filter by session type"
        className="flex w-max p-1 gap-1 rounded-full bg-white/[0.06] border border-[var(--rtd-hairline)]"
      >
        {OPTIONS.map((opt) => (
          <Link
            key={opt.key}
            href={opt.key === "all" ? "/swim/sessions" : `/swim/sessions?type=${opt.key}`}
            role="tab"
            aria-selected={opt.key === current}
            data-pill-key={opt.key}
            className="relative z-10 min-h-11 px-3.5 py-1.5 rounded-full text-footnote font-medium cursor-pointer whitespace-nowrap transition-colors duration-200 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 flex items-center justify-center"
            style={{ color: opt.key === current ? "#fff" : "var(--rtd-text-secondary)" }}
          >
            {opt.label}
          </Link>
        ))}
      </SlidingPillNav>
    </div>
  );
}
