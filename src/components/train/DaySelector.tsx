"use client";

import { useRouter } from "next/navigation";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const LABELS: Record<string, string> = { tue: "Tue", thu: "Thu", sun: "Sun" };

export function DaySelector({
  phaseId,
  days,
  current,
}: {
  phaseId: string;
  days: string[];
  current: string;
}) {
  const router = useRouter();
  return (
    <SegmentedControl
      value={current}
      onChange={(day) => router.push(`/train/${phaseId}?day=${day}`)}
      options={days.map((d) => ({ value: d, label: LABELS[d] ?? d }))}
    />
  );
}
