import { SectionLabel } from "@/components/ui/SectionLabel";
import { SettingsForm } from "@/components/more/SettingsForm";
import { getSettingsRow } from "@/lib/db/queries";

export default async function SettingsPage() {
  const settingsRow = await getSettingsRow();

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1">
      <SectionLabel>Settings</SectionLabel>
      <SettingsForm
        initialAsean={settingsRow.aseanConfirmed}
        initialWaterTargetMl={settingsRow.waterTargetMl}
        initialWeightUnit={settingsRow.weightUnit as "kg" | "lb"}
      />
    </div>
  );
}
