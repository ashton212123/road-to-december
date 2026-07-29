import { SectionHeader } from "@/components/ui/SectionHeader";
import { CrmClient } from "@/components/crm/CrmClient";
import { getCrmData } from "@/lib/crm/queries";
import { syncCrmMirror } from "@/lib/crm/mirror";
import { withRetry } from "@/lib/db/withRetry";

export default async function CrmPage() {
  // Runs on every page load per spec §3a -- cheap (two batched upserts, see
  // mirror.ts) and keeps business/canvas-sourced tasks fresh without a
  // separate background job.
  await withRetry(() => syncCrmMirror(), { label: "CRM mirror sync" });
  const data = await withRetry(() => getCrmData(), { label: "CRM data" });

  return (
    <div className="md:max-w-4xl md:mx-auto">
      <SectionHeader title="CRM" className="mb-2" />
      <CrmClient data={data} />
    </div>
  );
}
