"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { DotStrip, type DotStatus } from "@/components/ui/DotStrip";
import { IconCheck } from "@/components/ui/icons";
import { toggleHabitSubtaskAction } from "@/app/(app)/home/actions";
import type { HabitWithTodayLog } from "@/lib/habits/queries";

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
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-subhead font-medium text-[var(--rtd-text-secondary)] rtd-nums rtd-mono">
          {totalDone}/{localHabits.length} · {pct}%
        </span>
        <DotStrip periods={dots} />
      </div>
      <div className="flex flex-col gap-2.5 overflow-y-auto">
        {localHabits.map((habit) => (
          <div key={habit.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
                style={{
                  background: habit.completed ? "var(--rtd-green)" : "transparent",
                  border: habit.completed ? "none" : "1px solid var(--rtd-hairline)",
                }}
              >
                {habit.completed && <IconCheck size={11} />}
              </span>
              <span
                className="text-subhead font-medium"
                style={{ color: habit.completed ? "var(--rtd-text-tertiary)" : "var(--rtd-text)" }}
              >
                {habit.name}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pl-6">
              {habit.subtasks.map((sub) => {
                const done = habit.doneSubtaskIds.includes(sub.id);
                return (
                  <button
                    key={sub.id}
                    onClick={() => toggle(habit.id, sub.id)}
                    className="rtd-tap-target text-caption rounded-full px-2.5 py-1 border transition-colors"
                    style={{
                      borderColor: done ? "var(--rtd-green)" : "var(--rtd-hairline)",
                      background: done ? "rgba(52,199,89,0.12)" : "transparent",
                      color: done ? "var(--rtd-green)" : "var(--rtd-text-secondary)",
                    }}
                  >
                    {sub.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {localHabits.length === 0 && (
          <span className="text-subhead text-[var(--rtd-text-tertiary)]">No habits yet — add some in Settings.</span>
        )}
      </div>
    </TerminalPanel>
  );
}
