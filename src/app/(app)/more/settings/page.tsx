import { SectionLabel } from "@/components/ui/SectionLabel";
import { SettingsForm } from "@/components/more/SettingsForm";
import { getSettingsRow } from "@/lib/db/queries";
import { withRetry } from "@/lib/db/withRetry";

export default async function SettingsPage() {
  const settingsRow = await withRetry(() => getSettingsRow());

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1 md:max-w-xl md:mx-auto">
      <SectionLabel>Settings</SectionLabel>
      <SettingsForm
        initialAsean={settingsRow.aseanConfirmed}
        initialWaterTargetMl={settingsRow.waterTargetMl}
        initialWeightUnit={settingsRow.weightUnit as "kg" | "lb"}
      />
    </div>
  );
}
