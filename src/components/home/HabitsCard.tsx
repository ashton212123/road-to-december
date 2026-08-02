"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { DotStrip, type DotStatus } from "@/components/ui/DotStrip";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { IconCheck } from "@/components/ui/icons";
import { toggleHabitSubtaskAction } from "@/app/(app)/home/actions";
import type { HabitWithTodayLog } from "@/lib/habits/queries";

/** Which subtask a tile tap should toggle -- fills the next undone one
 * (so a tap always advances the counter), or un-toggles the last one once
 * every subtask is done (so a tap always does *something* on a full tile).
 * Habits with zero subtasks have nothing to toggle from the tile. */
function nextToggleId(habit: HabitWithTodayLog): string | null {
  if (habit.subtasks.length === 0) return null;
  const undone = habit.subtasks.find((s) => !habit.doneSubtaskIds.includes(s.id));
  return undone ? undone.id : habit.subtasks[habit.subtasks.length - 1].id;
}

export function HabitsCard({
  habits,
  dots,
  today,
  className,
}: {
  habits: HabitWithTodayLog[];
  dots: { status: DotStatus; label: string }[];
  today: string;
  className?: string;
}) {
  console.log(`[DEBUG-1B] HabitsCard received ${habits.length} habits`, JSON.stringify(habits[0] ?? null));
  const [localHabits, setLocalHabits] = useState<HabitWithTodayLog[]>(habits);
  // Guards the effect below against a fresh server re-render (after
  // revalidatePath/updateTag fires post-tap) clobbering a tap whose write
  // hasn't round-tripped yet -- §3.7's "mount-time GET must not clobber a
  // fresh local edit" applies here since this card resyncs from props on
  // every parent re-render, not just at mount.
  const dirtyRef = useRef(false);
  const [, startTransition] = useTransition();
  const storageKey = `rtd-habits-${today}`;

  useEffect(() => {
    if (dirtyRef.current) return;
    setLocalHabits(habits);
  }, [habits]);

  // Best-effort local mirror for instant feedback on the next mount (§4a) --
  // the props above are always the eventual source of truth once they land.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(Object.fromEntries(localHabits.map((h) => [h.id, h.doneSubtaskIds])))
      );
    } catch {
      // ignore quota/private-mode errors -- this is a cache, not storage of record
    }
  }, [localHabits, storageKey]);

  function toggle(habitId: number, subtaskId: string) {
    dirtyRef.current = true;
    setLocalHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const has = h.doneSubtaskIds.includes(subtaskId);
        const doneSubtaskIds = has ? h.doneSubtaskIds.filter((id) => id !== subtaskId) : [...h.doneSubtaskIds, subtaskId];
        return { ...h, doneSubtaskIds, completed: h.subtasks.length > 0 && doneSubtaskIds.length >= h.subtasks.length };
      })
    );
    startTransition(async () => {
      try {
        await toggleHabitSubtaskAction(habitId, subtaskId);
      } catch (err) {
        console.error(`HabitsCard: toggleHabitSubtaskAction failed for habit ${habitId}/${subtaskId}`, err);
      } finally {
        dirtyRef.current = false;
      }
    });
  }

  const totalDone = localHabits.filter((h) => h.completed).length;
  const pct = localHabits.length > 0 ? Math.round((totalDone / localHabits.length) * 100) : 0;

  return (
    <TerminalPanel label="03 // HABITS" colSpan={4} rowSpan={2} className={className}>
      <div className="flex justify-end mb-1 shrink-0">
        <DotStrip periods={dots} />
      </div>
      <div className="flex gap-3 flex-1 min-h-0">
        <div className="shrink-0 flex items-start pt-0.5">
          <ProgressRing
            pct={pct}
            size={72}
            strokeWidth={6}
            color="var(--rtd-green)"
            label={`${totalDone}/${localHabits.length}`}
            sub="TODAY"
            ariaLabel={`Habits completed today: ${totalDone} of ${localHabits.length}`}
          />
        </div>
        {localHabits.length === 0 ? (
          <Link
            href="/more/settings"
            className="rtd-tap-target flex-1 min-w-0 flex flex-col items-center justify-center gap-1 rounded-[8px] border border-dashed border-[var(--rtd-hairline)] px-3 py-4 text-center hover:bg-white/[0.04] transition-colors duration-150 ease-out"
          >
            <span className="text-subhead font-medium text-[var(--rtd-text-secondary)]">+ Add your first habit</span>
            <span className="text-caption text-[var(--rtd-text-tertiary)]">Set it up in Settings</span>
          </Link>
        ) : (
          <div className="flex-1 min-w-0 grid grid-cols-3 auto-rows-min gap-1.5 overflow-y-auto content-start">
            {localHabits.map((habit) => {
              const total = habit.subtasks.length;
              const done = habit.doneSubtaskIds.length;
              const nextId = nextToggleId(habit);
              return (
                <button
                  key={habit.id}
                  onClick={() => nextId && toggle(habit.id, nextId)}
                  disabled={!nextId}
                  className="rtd-tap-target flex flex-col items-start gap-0.5 rounded-[8px] border px-2 py-1.5 text-left transition-colors disabled:cursor-default"
                  style={{
                    borderColor: habit.completed ? "var(--rtd-green)" : "var(--rtd-hairline)",
                    background: habit.completed ? "rgba(52,199,89,0.12)" : "rgba(255,255,255,0.02)",
                  }}
                >
                  <div className="flex items-center gap-1.5 w-full min-w-0">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center"
                      style={{
                        background: habit.completed ? "var(--rtd-green)" : "transparent",
                        border: habit.completed ? "none" : "1px solid var(--rtd-hairline)",
                      }}
                    >
                      {habit.completed && <IconCheck size={9} />}
                    </span>
                    <span
                      className="text-caption font-medium truncate"
                      style={{ color: habit.completed ? "var(--rtd-text-tertiary)" : "var(--rtd-text)" }}
                    >
                      {habit.name}
                    </span>
                  </div>
                  <span className="rtd-micro-label truncate w-full">{habit.category}</span>
                  <span className="text-caption rtd-nums rtd-mono text-[var(--rtd-text-secondary)]">
                    {total > 0 ? `${done}/${total}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </TerminalPanel>
  );
}
