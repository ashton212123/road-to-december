import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState } from "@/components/ui/EmptyState";

export default function MorePage() {
  return (
    <div className="flex flex-col gap-4 rtd-fade-in">
      <SectionLabel>More</SectionLabel>
      <EmptyState title="Recovery, Coach AI and Settings are being wired up" body="These land in a later milestone." />
    </div>
  );
}
