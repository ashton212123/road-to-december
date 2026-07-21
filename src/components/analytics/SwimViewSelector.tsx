"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

export type SwimView = "log" | "meets" | "analysis";

const LABELS: Record<SwimView, string> = { log: "Log", meets: "Meets", analysis: "Analysis" };

/** URL-param driven (same Link-push pattern as DaySelector) so each view
 * stays a fully server-rendered page load, not client-side tab switching. */
export function SwimViewSelector({ current }: { current: SwimView }) {
  const router = useRouter();
  return (
    <SegmentedControl
      value={current}
      onChange={(view) => router.push(`/swim?view=${view}`)}
      options={(["log", "meets", "analysis"] as SwimView[]).map((v) => ({ value: v, label: LABELS[v] }))}
    />
  );
}
