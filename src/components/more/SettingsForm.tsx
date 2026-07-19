"use client";

import { useState, useTransition } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { updateSettingsAction } from "@/app/(app)/more/actions";

type AseanChoice = "unknown" | "confirmed" | "cancelled";

export function SettingsForm({
  initialAsean,
  initialWaterTargetMl,
  initialWeightUnit,
}: {
  initialAsean: boolean | null;
  initialWaterTargetMl: number;
  initialWeightUnit: "kg" | "lb";
}) {
  const [asean, setAsean] = useState<AseanChoice>(
    initialAsean === true ? "confirmed" : initialAsean === false ? "cancelled" : "unknown"
  );
  const [waterTarget, setWaterTarget] = useState(String(initialWaterTargetMl));
  const [weightUnit, setWeightUnit] = useState<"kg" | "lb">(initialWeightUnit);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      await updateSettingsAction({
        aseanConfirmed: asean === "confirmed" ? true : asean === "cancelled" ? false : null,
        waterTargetMl: Number(waterTarget) || 3000,
        weightUnit,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <GlassCard className="flex flex-col gap-3">
        <div>
          <div className="text-body font-semibold">ASEAN School Games status</div>
          <div className="text-subhead text-[var(--rtd-text-secondary)] mt-0.5">
            Recomputes the race-block plan: confirmed = mini-taper into ~Nov 25 then micro-doses to
            Dec 4; cancelled = Power runs to ~Nov 25, full 8-day taper Nov 26–Dec 3.
          </div>
        </div>
        <SegmentedControl
          value={asean}
          onChange={setAsean}
          options={[
            { value: "unknown", label: "Unknown" },
            { value: "confirmed", label: "Confirmed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <div className="text-body font-semibold">Daily water target</div>
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={waterTarget}
            onChange={(e) => setWaterTarget(e.target.value)}
            className="flex-1 rounded-lg bg-white/[0.06] px-3 py-2 text-subhead outline-none"
          />
          <span className="text-footnote text-[var(--rtd-text-secondary)]">ml</span>
        </div>
      </GlassCard>

      <GlassCard className="flex flex-col gap-3">
        <div className="text-body font-semibold">Weight unit</div>
        <SegmentedControl
          value={weightUnit}
          onChange={setWeightUnit}
          options={[
            { value: "kg", label: "kg" },
            { value: "lb", label: "lb" },
          ]}
        />
      </GlassCard>

      <Button onClick={save} disabled={pending} className="md:w-auto md:self-end md:px-8">
        {saved ? "Saved ✓" : "Save settings"}
      </Button>

      <GlassCard className="flex flex-col gap-2">
        <div className="text-body font-semibold">Export your data</div>
        <div className="text-subhead text-[var(--rtd-text-secondary)]">
          A full JSON dump of everything logged in this app. You must never be locked in.
        </div>
        <a href="/api/export" download>
          <Button variant="secondary" className="w-full mt-1">
            Download full export (.json)
          </Button>
        </a>
      </GlassCard>
    </div>
  );
}
