"use client";

import { useState, useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { Button } from "@/components/ui/Button";
import { logSleepAction } from "@/app/(app)/more/actions";
import { todayDayKey } from "@/lib/time";

export function SleepLogger({ lastNight = null }: { lastNight?: { hours: number; bedtime: string | null } | null }) {
  const [hours, setHours] = useState("8");
  const [bedtime, setBedtime] = useState("21:30");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);

  const isBedtimeCheckDay = todayDayKey() === "tue" || todayDayKey() === "thu";

  function submit() {
    const onTime = isBedtimeCheckDay ? bedtime <= "21:30" : null;
    startTransition(async () => {
      await logSleepAction({ hours: Number(hours), bedtime, onTime });
      setDone(true);
    });
  }

  return (
    <TerminalPanel className="gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-body font-semibold">Sleep</div>
        {lastNight && (
          <button
            type="button"
            onClick={() => {
              setHours(String(lastNight.hours));
              if (lastNight.bedtime) setBedtime(lastNight.bedtime);
            }}
            className="text-caption px-2.5 py-1 rounded-full bg-white/[0.06] text-[var(--rtd-text-secondary)] cursor-pointer hover:brightness-110 active:scale-[0.98] transition-transform duration-150 ease-out"
          >
            Same as last night
          </button>
        )}
      </div>
      {isBedtimeCheckDay && (
        <div className="text-subhead text-[var(--rtd-orange)] bg-[var(--rtd-orange)]/10 rounded-lg px-2.5 py-1.5">
          Tue/Thu rule: lights out by 9:30 PM — a 5 AM alarm follows.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="rtd-micro-label">Hours</span>
          <input
            inputMode="decimal"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-3 py-2 text-subhead text-center outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="rtd-micro-label">Bedtime</span>
          <input
            type="time"
            value={bedtime}
            onChange={(e) => setBedtime(e.target.value)}
            className="rounded-lg bg-white/[0.06] px-3 py-2 text-subhead text-center outline-none"
          />
        </label>
      </div>
      <Button variant="secondary" onClick={submit} disabled={pending}>
        {done ? "Logged ✓" : "Log last night"}
      </Button>
    </TerminalPanel>
  );
}
