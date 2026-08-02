import { SectionHeader } from "@/components/ui/SectionHeader";
import { CrmClient } from "@/components/crm/CrmClient";
import { getCrmData } from "@/lib/crm/queries";
import { syncCrmMirror } from "@/lib/crm/mirror";
import { withRetry } from "@/lib/db/withRetry";
import { withFallback } from "@/lib/db/withFallback";

export default async function CrmPage() {
  // Runs on every page load per spec §3a -- cheap (two batched upserts, see
  // mirror.ts) and keeps business/canvas-sourced tasks fresh without a
  // separate background job. Guarded with withFallback so a slow/failed
  // sync degrades to "skip this load's mirror refresh" instead of taking
  // the whole board down -- same pool-contention risk as WS3d §1.
  await withFallback(withRetry(() => syncCrmMirror(), { label: "CRM mirror sync" }), undefined);
  const data = await withFallback(withRetry(() => getCrmData(), { label: "CRM data" }), { open: [], archived: [] });

  return (
    <div className="md:max-w-4xl md:mx-auto">
      <SectionHeader title="CRM" className="mb-2" />
      <CrmClient data={data} />
    </div>
  );
}
