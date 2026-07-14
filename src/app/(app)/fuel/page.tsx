import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState } from "@/components/ui/EmptyState";

export default function FuelPage() {
  return (
    <div className="flex flex-col gap-4 rtd-fade-in">
      <SectionLabel>Fuel</SectionLabel>
      <EmptyState title="Fuel targets are being wired up" body="Kcal, protein and water rings plus the meal timeline land in the next milestone." />
    </div>
  );
}
