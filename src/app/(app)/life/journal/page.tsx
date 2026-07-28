import { SectionLabel } from "@/components/ui/SectionLabel";
import { JournalClient } from "@/components/journal/JournalClient";
import { getJournalEntries } from "@/lib/journal/queries";
import { withRetry } from "@/lib/db/withRetry";

export default async function JournalPage() {
  const entries = await withRetry(() => getJournalEntries());

  return (
    <div className="flex flex-col gap-3 pt-1 md:max-w-2xl md:mx-auto">
      <SectionLabel>Journal</SectionLabel>
      <JournalClient entries={entries} />
    </div>
  );
}
