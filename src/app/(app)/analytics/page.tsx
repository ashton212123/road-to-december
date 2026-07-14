import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState } from "@/components/ui/EmptyState";

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col gap-4 rtd-fade-in">
      <SectionLabel>Analytics</SectionLabel>
      <EmptyState title="Charts are being wired up" body="Strength, load, power, bodyweight and swim analytics land in a later milestone." />
    </div>
  );
}
