import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState } from "@/components/ui/EmptyState";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-4 rtd-fade-in">
      <SectionLabel>Home</SectionLabel>
      <EmptyState title="Home is being wired up" body="Countdown, today's session and quick stats land in the next milestone." />
    </div>
  );
}
