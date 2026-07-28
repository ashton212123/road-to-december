import { SectionLabel } from "@/components/ui/SectionLabel";
import { BrainClient } from "@/components/brain/BrainClient";

export default function BrainPage() {
  return (
    <div className="flex flex-col gap-3 pt-1 md:max-w-2xl md:mx-auto">
      <SectionLabel>Brain</SectionLabel>
      <BrainClient />
    </div>
  );
}
