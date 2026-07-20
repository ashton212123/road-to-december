import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_cache } from "next/cache";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { BentoCard } from "@/components/ui/BentoCard";
import { LearnLevelRow } from "@/components/learn/LearnLevelRow";
import { getLearnProgress } from "@/lib/db/queries";
import { findTrack } from "@/lib/data/learn-tracks";
import { withRetry } from "@/lib/db/withRetry";

const getCachedProgress = unstable_cache(getLearnProgress, ["learn-progress"], { tags: ["learn-data"] });

export default async function LearnTrackPage({ params }: { params: Promise<{ trackId: string }> }) {
  const { trackId } = await params;
  const track = findTrack(trackId);
  if (!track) notFound();

  const progress = await withRetry(() => getCachedProgress());
  const done = new Set(progress.filter((p) => p.trackId === trackId).map((p) => p.levelKey));
  const upNextKey = track.levels.find((l) => !done.has(l.key))?.key;

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1 md:max-w-2xl md:mx-auto">
      <div className="flex items-center gap-2">
        <Link
          href="/learn"
          className="text-[var(--rtd-text-tertiary)] hover:text-[var(--rtd-text)] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 rounded-md"
          aria-label="Back to Learn"
        >
          ‹ Learn
        </Link>
      </div>
      <SectionLabel right={<span className="text-caption text-[var(--rtd-text-tertiary)] rtd-nums">{done.size}/{track.levels.length}</span>}>
        {track.title}
      </SectionLabel>
      <p className="text-footnote text-[var(--rtd-text-secondary)] leading-snug -mt-2">{track.blurb}</p>

      <BentoCard>
        <div className="flex flex-col rtd-divide-y">
          {track.levels.map((level) => (
            <LearnLevelRow
              key={level.key}
              trackId={track.id}
              trackTitle={track.title}
              level={level}
              initialCompleted={done.has(level.key)}
              isUpNext={level.key === upNextKey}
              gradient={track.gradient}
            />
          ))}
        </div>
      </BentoCard>

      <a
        href={track.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-caption text-[var(--rtd-text-tertiary)] hover:text-[var(--rtd-text-secondary)] transition-colors duration-150 ease-out text-center"
      >
        Source: {track.sourceLabel} ↗
      </a>
    </div>
  );
}
