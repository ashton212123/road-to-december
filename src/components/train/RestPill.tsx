"use client";

import { useEffect } from "react";
import clsx from "clsx";
import type { ActiveRest } from "./WorkoutSession";
import { useKeyboardOpen } from "@/lib/useKeyboardOpen";

function formatMMSS(totalSec: number) {
  const s = Math.max(0, Math.round(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Sticky, session-level rest timer -- replaces the old per-card row that
 * vanished the moment a card collapsed or scrolled off. Counts DOWN to the
 * exercise's prescribed rest (flips to "+m:ss over" past zero) instead of
 * counting up, so you can read remaining time at a glance instead of doing
 * the subtraction yourself mid-set. */
export function RestPill({
  activeRest,
  now,
  onDismiss,
}: {
  activeRest: ActiveRest | null;
  now: number | null;
  onDismiss: () => void;
}) {
  const elapsed = activeRest && now !== null ? Math.floor((now - activeRest.startedAt) / 1000) : null;
  const remaining = elapsed !== null && activeRest?.targetSec ? activeRest.targetSec - elapsed : null;
  const isOver = remaining !== null && remaining <= 0;
  const keyboardOpen = useKeyboardOpen();

  useEffect(() => {
    if (isOver) navigator.vibrate?.(200);
  }, [isOver]);

  // The keyboard only opens here via a set/rep/RPE input mid-rest -- the
  // pill would otherwise float on top of the keyboard or the field being
  // typed into.
  if (!activeRest || elapsed === null || keyboardOpen) return null;

  const overSec = remaining !== null ? -remaining : 0;
  const severity: "neutral" | "on-target" | "over-mild" | "over-hard" = !activeRest.targetSec
    ? "neutral"
    : !isOver
      ? "on-target"
      : overSec < activeRest.targetSec * 0.3
        ? "over-mild"
        : "over-hard";

  // The athlete finished a set with no idea a rest timer existed -- for the
  // first couple ticks, announce that it started (with the full target)
  // instead of immediately showing a countdown that's easy to miss glancing
  // past. Driven off the same elapsed clock, no extra timer.
  const justStarted = elapsed < 3;
  const label =
    justStarted && activeRest.targetSec
      ? `Rest started — ${formatMMSS(activeRest.targetSec)}`
      : !activeRest.targetSec
        ? formatMMSS(elapsed)
        : !isOver
          ? formatMMSS(remaining ?? 0)
          : `+${formatMMSS(overSec)} over`;

  const color =
    severity === "over-hard"
      ? "var(--rtd-red)"
      : severity === "over-mild"
        ? "var(--rtd-orange)"
        : "var(--rtd-green)";

  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label={`Rest timer for ${activeRest.exerciseName}: ${label}. Tap to dismiss.`}
      className={clsx(
        // Left-aligned on mobile (not centered) so it never overlaps the
        // coach FAB parked at right-4 -- max-width leaves that corridor clear.
        "fixed z-40 left-4 right-auto translate-x-0 bottom-[calc(env(safe-area-inset-bottom)+84px)] max-w-[calc(100vw-96px)] md:left-6 md:bottom-6 md:max-w-none",
        "flex items-center gap-2.5 rounded-full px-4 py-2.5 cursor-pointer active:scale-95 transition-transform duration-150 ease-out rtd-fade-in",
        isOver && "rtd-rest-pulse"
      )}
      style={{
        backgroundColor: "rgba(20,20,22,0.88)",
        border: `1px solid ${color}`,
        backdropFilter: "blur(var(--rtd-blur))",
        WebkitBackdropFilter: "blur(var(--rtd-blur))",
      }}
    >
      <span className="text-subhead font-semibold truncate max-w-[140px] text-[var(--rtd-text)]">
        {activeRest.exerciseName}
      </span>
      <span className="text-subhead font-bold rtd-nums rtd-mono" style={{ color }}>
        {label}
      </span>
    </button>
  );
}
