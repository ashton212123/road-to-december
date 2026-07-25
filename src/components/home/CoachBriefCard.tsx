import Link from "next/link";
import { BentoCard } from "@/components/ui/BentoCard";
import { IconSparkle } from "@/components/ui/icons";

export function CoachBriefCard({
  brief,
  bullets,
  followUps,
  className,
}: {
  brief: string | null;
  bullets: string[];
  followUps: string[];
  className?: string;
}) {
  return (
    <BentoCard variant="open" colSpan={4} rowSpan={3} className={className}>
      <Link href="/more/coach-ai" className="flex items-center gap-2 mb-1 w-fit cursor-pointer">
        <span className="text-[var(--rtd-purple)]">
          <IconSparkle />
        </span>
        <span className="rtd-micro-label">Coach brief</span>
      </Link>
      <p className="text-subhead text-[var(--rtd-text)] leading-snug shrink-0">
        {brief ?? "Your coach doesn't have a brief yet today — ask a question to get started."}
      </p>
      {bullets.length > 0 && (
        <ul className="flex flex-col gap-1 mt-2 flex-1 min-h-0 overflow-y-auto">
          {bullets.map((b) => (
            <li key={b} className="flex items-baseline gap-1.5 text-caption text-[var(--rtd-text-secondary)]">
              <span className="text-[var(--rtd-purple)] shrink-0">·</span>
              <span className="truncate">{b}</span>
            </li>
          ))}
        </ul>
      )}
      {followUps.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2 shrink-0">
          {followUps.map((q) => (
            <Link
              key={q}
              href={`/more/coach-ai?q=${encodeURIComponent(q)}`}
              className="text-caption px-2.5 py-1.5 rounded-full bg-white/[0.06] text-[var(--rtd-text-secondary)] truncate cursor-pointer hover:brightness-110 active:scale-[0.98] transition-transform duration-150 ease-out"
            >
              {q}
            </Link>
          ))}
        </div>
      )}
    </BentoCard>
  );
}
