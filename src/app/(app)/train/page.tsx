import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TrainPage() {
  return (
    <div className="flex flex-col gap-4 rtd-fade-in">
      <SectionLabel>Train</SectionLabel>
      <EmptyState title="Phase browser is being wired up" body="The 6-phase program and set logger land in the next milestone." />
    </div>
  );
}
