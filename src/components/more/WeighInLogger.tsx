"use client";

import { useState, useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { Button } from "@/components/ui/Button";
import { logWeighInAction } from "@/app/(app)/fuel/actions";

/** No dedicated weigh-in UI existed anywhere in the app before V4 P5 --
 * logging only ever happened via MCP/Coach chat. Ghost-prefills with the
 * most recently logged weight so confirming untouched just re-confirms
 * "still about the same," matching the ghost-value pattern used in set
 * editing. */
export function WeighInLogger({ lastKg }: { lastKg: number | null }) {
  const [kg, setKg] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const ghost = lastKg !== null ? String(lastKg) : "";

  function submit() {
    const used = kg ? Number(kg) : lastKg;
    if (used === null) return;
    startTransition(async () => {
      await logWeighInAction(used);
      setDone(true);
    });
  }

  return (
    <TerminalPanel className="gap-3">
      <div className="text-body font-semibold">Weigh-in</div>
      <div className="flex items-center gap-2">
        <input
          inputMode="decimal"
          value={kg}
          placeholder={ghost || "kg"}
          onChange={(e) => setKg(e.target.value)}
          className="flex-1 rounded-lg bg-white/[0.06] px-3 py-2 text-subhead text-center outline-none placeholder:text-[var(--rtd-text-tertiary)]"
        />
        <span className="text-footnote text-[var(--rtd-text-secondary)]">kg</span>
      </div>
      <Button variant="secondary" onClick={submit} disabled={pending || (!kg && lastKg === null)}>
        {done ? "Logged ✓" : "Log weigh-in"}
      </Button>
    </TerminalPanel>
  );
}
