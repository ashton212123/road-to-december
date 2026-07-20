"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { logWaterAction } from "@/app/(app)/fuel/actions";
import { SleepLogger } from "@/components/more/SleepLogger";
import { WeighInLogger } from "@/components/more/WeighInLogger";
import { SorenessLogger } from "@/components/more/SorenessLogger";
import { ImportSessionButton } from "@/components/train/ImportSessionButton";

type ExpandKey = "sleep" | "weighIn" | "soreness" | null;

function RowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2.5 cursor-pointer hover:bg-white/[0.06] transition-colors duration-150 ease-out text-left"
    >
      <span className="text-subhead text-[var(--rtd-text)]">{label}</span>
      <span className="text-[var(--rtd-text-tertiary)]" aria-hidden="true">
        →
      </span>
    </button>
  );
}

/** V4 P5 -- the "two taps from Home" quick-log entry point: a 36px glass "+"
 * next to the avatar (both viewports), opening a sheet with the six most
 * common daily actions. Water logs instantly on tap; sleep/weigh-in/
 * soreness expand in place to the same logger components used on the
 * Recovery page; meal deep-links to Fuel's quick log; import reuses
 * ImportSessionButton's flow in controlled mode instead of duplicating it. */
export function QuickLogSheet({
  lastNightSleep,
  lastWeighInKg,
  phaseId,
  todayExercises,
}: {
  lastNightSleep: { hours: number; bedtime: string | null } | null;
  lastWeighInKg: number | null;
  phaseId: string | null;
  todayExercises: { id: number; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<ExpandKey>(null);
  const [waterLogged, setWaterLogged] = useState(false);
  const [waterPending, startWater] = useTransition();
  const [importOpen, setImportOpen] = useState(false);

  function close() {
    setOpen(false);
    setExpanded(null);
    setWaterLogged(false);
  }

  function logWater() {
    startWater(async () => {
      await logWaterAction(500);
      setWaterLogged(true);
      setTimeout(() => setWaterLogged(false), 1500);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Quick log"
        className="w-9 h-9 rounded-full flex items-center justify-center bg-white/[0.08] text-body cursor-pointer hover:brightness-110 active:scale-95 transition-transform duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
      >
        +
      </button>

      {open && (
        <div
          className="rtd-glass-blur fixed inset-0 z-50 flex items-end md:items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Quick log"
        >
          <div
            className="rtd-glass rtd-glass-blur p-3.5 md:p-4 flex flex-col gap-2 w-full md:max-w-sm rounded-t-[16px] md:rounded-[10px] max-h-[80vh] overflow-y-auto"
            style={{ backgroundColor: "rgba(20,20,22,0.92)", paddingBottom: "calc(env(safe-area-inset-bottom) + 14px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-body font-semibold">Quick log</span>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="w-7 h-7 flex items-center justify-center rounded-full text-[var(--rtd-text-tertiary)] cursor-pointer hover:bg-white/10 hover:text-[var(--rtd-text)]"
              >
                ✕
              </button>
            </div>

            <button
              type="button"
              onClick={logWater}
              disabled={waterPending}
              className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2.5 cursor-pointer hover:bg-white/[0.06] transition-colors duration-150 ease-out text-left"
            >
              <span className="text-subhead text-[var(--rtd-text)]">Water +500ml</span>
              <span className="text-[var(--rtd-green)]" style={{ opacity: waterLogged ? 1 : 0, transition: "opacity 150ms ease-out" }}>
                ✓
              </span>
            </button>

            {expanded === "sleep" ? <SleepLogger lastNight={lastNightSleep} /> : <RowButton label="Sleep" onClick={() => setExpanded("sleep")} />}

            {expanded === "weighIn" ? (
              <WeighInLogger lastKg={lastWeighInKg} />
            ) : (
              <RowButton label="Weigh-in" onClick={() => setExpanded("weighIn")} />
            )}

            <Link
              href="/fuel#quick-log-mobile"
              onClick={close}
              className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2.5 cursor-pointer hover:bg-white/[0.06] transition-colors duration-150 ease-out"
            >
              <span className="text-subhead text-[var(--rtd-text)]">Log meal</span>
              <span className="text-[var(--rtd-text-tertiary)]" aria-hidden="true">
                →
              </span>
            </Link>

            {expanded === "soreness" ? <SorenessLogger /> : <RowButton label="Soreness" onClick={() => setExpanded("soreness")} />}

            <RowButton
              label="Import session"
              onClick={() => {
                close();
                setImportOpen(true);
              }}
            />
          </div>
        </div>
      )}

      <ImportSessionButton phaseId={phaseId} todayExercises={todayExercises} hideTrigger open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
