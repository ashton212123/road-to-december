import Link from "next/link";
import { BentoCard } from "@/components/ui/BentoCard";
import { IconSparkle } from "@/components/ui/icons";

export function CoachBriefCard({ brief, followUps }: { brief: string | null; followUps: string[] }) {
  return (
    <BentoCard colSpan={4} rowSpan={3}>
      <Link href="/more/coach-ai" className="flex items-center gap-2 mb-1 w-fit cursor-pointer">
        <span className="text-[var(--rtd-purple)]">
          <IconSparkle />
        </span>
        <span className="rtd-micro-label">Coach brief</span>
      </Link>
      <p className="text-subhead text-[var(--rtd-text)] leading-snug flex-1 overflow-y-auto">
        {brief ?? "Your coach doesn't have a brief yet today — ask a question to get started."}
      </p>
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
