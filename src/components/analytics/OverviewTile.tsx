import Link from "next/link";
import { Sparkline } from "@/components/ui/Sparkline";

/**
 * Whoop-style doorway tile (LOOP_PHASE5_PROMPT.md P6): domain color accent,
 * one oversized headline stat, a 7-day sparkline, the existing one-line
 * takeaway, chevron -- the whole tile is the Link to its detail tab. This is
 * the one place NEW light card chrome is allowed in the unboxing pass
 * (loop 29) since tiles are tappable doorways, not passive data.
 */
export function OverviewTile({
  href,
  label,
  domainColor,
  headline,
  sparkline,
  takeaway,
}: {
  href: string;
  label: string;
  domainColor: string;
  headline: string;
  sparkline: number[];
  takeaway: string | null;
}) {
  return (
    <Link
      href={href}
      className="rtd-glass rtd-bento-card flex flex-col gap-2 p-4 cursor-pointer hover:bg-white/[0.04] active:scale-[0.99] transition-[background-color,transform] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
    >
      <div className="flex items-center justify-between">
        <span className="rtd-micro-label" style={{ color: domainColor }}>
          {label}
        </span>
        <span className="text-[var(--rtd-text-tertiary)]" aria-hidden="true">
          ›
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="rtd-big-num rtd-nums">{headline}</span>
        <Sparkline points={sparkline} color={domainColor} width={80} height={32} endDot />
      </div>
      <span className="text-caption text-[var(--rtd-text-secondary)] leading-snug">
        {takeaway ?? "No takeaway yet — log a few sessions."}
      </span>
    </Link>
  );
}
