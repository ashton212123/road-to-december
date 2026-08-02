import { Suspense } from "react";
import Link from "next/link";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SwimSessionTypeFilter } from "@/components/swim/SwimSessionTypeFilter";
import { SESSION_TYPES, type SessionType } from "@/lib/swim/sessionType";
import { SwimSessionsContent } from "./SwimSessionsSections";
import { SwimSessionsSkeleton } from "./SwimSessionsSkeleton";

// WS4 §4c: this page used to block entirely on one unguarded query (no
// withFallback, no Suspense) -- a connection hiccup threw all the way to the
// blank SSR error boundary instead of ever reaching this header. The header
// and filter need no data, so they now render synchronously and immediately;
// only the session list itself streams in via Suspense (see data.ts /
// SwimSessionsSections.tsx), same page-layout convention as home/page.tsx.
export default async function SwimSessionsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type: rawType } = await searchParams;
  const typeFilter: SessionType | "all" = rawType && SESSION_TYPES.includes(rawType as SessionType) ? (rawType as SessionType) : "all";

  return (
    <div className="flex flex-col gap-4 pt-1">
      <SectionHeader
        title="All sessions"
        className="mb-2"
        statusChip={
          <Link href="/swim" className="rtd-tap-target text-caption text-[var(--rtd-cyan)] cursor-pointer hover:brightness-110 whitespace-nowrap">
            ← Back
          </Link>
        }
      />

      <SwimSessionTypeFilter current={typeFilter} />

      <Suspense fallback={<SwimSessionsSkeleton />}>
        <SwimSessionsContent typeFilter={typeFilter} />
      </Suspense>
    </div>
  );
}
