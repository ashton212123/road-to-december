"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

export type FuelView = "today" | "plan" | "history";

const LABELS: Record<FuelView, string> = { today: "Today", plan: "Plan", history: "History" };

/** Mirrors SwimViewSelector's URL-param-driven pattern -- each view is a
 * fully server-rendered page load, not client-side tab switching. */
export function FuelViewSelector({ current }: { current: FuelView }) {
  const router = useRouter();
  return (
    <SegmentedControl
      value={current}
      onChange={(view) => router.push(`/fuel?view=${view}`)}
      options={(["today", "plan", "history"] as FuelView[]).map((v) => ({ value: v, label: LABELS[v] }))}
    />
  );
}
