"use client";

import { useState, useTransition } from "react";
import { toggleLearnLevelAction } from "@/app/(app)/learn/actions";
import { IconCheck } from "@/components/ui/icons";
import type { LearnLevel } from "@/lib/data/learn-tracks";

/** One row of a track's progression: a tappable check-circle (server action,
 * optimistic) on the left, title+source topic in the middle, and the level's
 * GitHub link as a separate tap target on the right -- checking a level off
 * and opening it are two different intents and shouldn't share one hitbox. */
export function LearnLevelRow({
  trackId,
  level,
  initialCompleted,
  gradient,
}: {
  trackId: string;
  level: LearnLevel;
  initialCompleted: boolean;
  gradient: [string, string];
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [, startTransition] = useTransition();

  function toggle() {
    const next = !completed;
    setCompleted(next);
    startTransition(async () => {
      await toggleLearnLevelAction(trackId, level.key, next);
    });
  }

  return (
    <div className="flex items-center gap-3 min-h-12 px-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={completed}
        aria-label={completed ? `Mark ${level.title} incomplete` : `Mark ${level.title} complete`}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer transition-transform duration-150 ease-out active:scale-[0.9] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
        style={{
          background: completed ? `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})` : "rgba(255,255,255,0.06)",
          border: completed ? "none" : "1px solid var(--rtd-border)",
        }}
      >
        {completed && <IconCheck size={14} />}
      </button>
      <a
        href={level.href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 min-w-0 flex flex-col cursor-pointer hover:opacity-80 transition-opacity duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 rounded-md"
      >
        <span
          className="text-subhead font-medium truncate"
          style={{ color: completed ? "var(--rtd-text-tertiary)" : "var(--rtd-text)", textDecoration: completed ? "line-through" : undefined }}
        >
          {level.title}
        </span>
        {level.sub && <span className="text-caption text-[var(--rtd-text-tertiary)] truncate">{level.sub}</span>}
      </a>
      <span className="shrink-0 text-[var(--rtd-text-tertiary)]" aria-hidden="true">
        ↗
      </span>
    </div>
  );
}
