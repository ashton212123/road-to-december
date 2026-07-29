import Link from "next/link";
import { unstable_cache } from "next/cache";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { getLearnProgress } from "@/lib/db/queries";
import { LEARN_TRACKS } from "@/lib/data/learn-tracks";
import { withRetry } from "@/lib/db/withRetry";

const getCachedProgress = unstable_cache(getLearnProgress, ["learn-progress"], { tags: ["learn-data"] });

export default async function LearnPage() {
  const progress = await withRetry(() => getCachedProgress(), { label: "Learn progress" });
  const doneByTrack = new Map<string, Set<string>>();
  for (const row of progress) {
    if (!doneByTrack.has(row.trackId)) doneByTrack.set(row.trackId, new Set());
    doneByTrack.get(row.trackId)!.add(row.levelKey);
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <SectionLabel>Learn</SectionLabel>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LEARN_TRACKS.map((track) => {
          const doneSet = doneByTrack.get(track.id);
          const done = doneSet?.size ?? 0;
          const total = track.levels.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const upNext = track.levels.find((l) => !doneSet?.has(l.key));
          return (
            <Link
              key={track.id}
              href={`/learn/${track.id}`}
              className="rtd-glass flex flex-col gap-3 p-4 cursor-pointer hover:bg-white/[0.04] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-headline font-semibold text-[var(--rtd-text)]">{track.title}</span>
                  <span className="text-caption text-[var(--rtd-text-tertiary)]">{track.sourceLabel}</span>
                </div>
                <span
                  className="shrink-0 rounded-full px-2 py-1 text-caption font-semibold rtd-nums"
                  style={{ background: `linear-gradient(135deg, ${track.gradient[0]}, ${track.gradient[1]})`, color: "#0b0b0d" }}
                >
                  {done}/{total}
                </span>
              </div>
              <p className="text-footnote text-[var(--rtd-text-secondary)] leading-snug">{track.blurb}</p>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct)}%`, background: `linear-gradient(90deg, ${track.gradient[0]}, ${track.gradient[1]})` }}
                />
              </div>
              <span className="text-caption text-[var(--rtd-text-tertiary)] truncate">
                {upNext ? `Up next: ${upNext.title}${upNext.sub ? ` — ${upNext.sub}` : ""}` : "Track complete 🎉"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
