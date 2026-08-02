import { unstable_cache } from "next/cache";
import { getSwimSessionsSince } from "@/lib/db/queries";
import { withRetry } from "@/lib/db/withRetry";
import { withFallback } from "@/lib/db/withFallback";

export const WEEKS_CAP = 26;

// Tagged "analytics-data" (not a new tag) so every existing swim log write
// action -- which already calls updateTag("analytics-data"), see
// swim/actions.ts -- revalidates this list too, with no new wiring.
const getCachedSwimSessionsSince = unstable_cache(
  async (sinceISO: string) => getSwimSessionsSince(sinceISO),
  ["swim-sessions-list-v1"],
  { tags: ["analytics-data"], revalidate: 300 }
);

// This route had no withFallback at all before WS4 §4c: a connection hiccup
// on this single query threw all the way to the app's error boundary
// instead of degrading to the page's own existing "No sessions in this
// window" empty state. Same withFallback(withRetry(...), fallback)
// composition as every other query in this codebase (WS3d/WS4).
export async function getSwimSessionsListData(sinceISO: string) {
  return withFallback(withRetry(() => getCachedSwimSessionsSince(sinceISO), { label: "Swim sessions list" }), []);
}
