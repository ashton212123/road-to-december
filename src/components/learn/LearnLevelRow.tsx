"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toggleLearnLevelAction } from "@/app/(app)/learn/actions";
import { IconCheck, IconSparkle } from "@/components/ui/icons";
import type { LearnLevel } from "@/lib/data/learn-tracks";

function coachHref(trackTitle: string, level: LearnLevel): string {
  const topic = level.sub ?? level.title;
  const q = `Teach me "${topic}" from ${trackTitle}. Explain it simply, then give me one exercise to do tonight.`;
  return `/more/coach-ai?q=${encodeURIComponent(q)}`;
}

/** One row of a track's progression: a tappable check-circle (server action,
 * optimistic) on the left, title+source topic in the middle, the level's
 * GitHub link and an ask-coach shortcut as separate tap targets on the right
 * -- checking a level off, opening it, and asking about it are three
 * different intents and shouldn't share hitboxes. `isUpNext` highlights the
 * first incomplete level so the track reads as a progression, not a flat
 * checklist. */
export function LearnLevelRow({
  trackId,
  trackTitle,
  level,
  initialCompleted,
  isUpNext,
  gradient,
}: {
  trackId: string;
  trackTitle: string;
  level: LearnLevel;
  initialCompleted: boolean;
  isUpNext: boolean;
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

  const upNext = isUpNext && !completed;
  const titleColor = completed ? "var(--rtd-text-tertiary)" : upNext ? "var(--rtd-text)" : "var(--rtd-text-secondary)";

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
          outline: upNext ? "1.5px solid rgba(255,255,255,0.8)" : "none",
          outlineOffset: upNext ? "2px" : undefined,
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
          style={{ color: titleColor, textDecoration: completed ? "line-through" : undefined }}
        >
          {level.title}
        </span>
        {level.sub && <span className="text-caption text-[var(--rtd-text-tertiary)] truncate">{level.sub}</span>}
      </a>
      <Link
        href={coachHref(trackTitle, level)}
        aria-label={`Ask coach about ${level.title}`}
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[var(--rtd-text-tertiary)] cursor-pointer hover:bg-white/[0.06] hover:text-[var(--rtd-purple)] transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2"
      >
        <IconSparkle size={14} />
      </Link>
      <span className="shrink-0 text-[var(--rtd-text-tertiary)]" aria-hidden="true">
        ↗
      </span>
    </div>
  );
}
