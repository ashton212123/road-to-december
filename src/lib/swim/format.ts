import type { Course } from "./course";

/** Short course-label badge text, e.g. for rendering next to a time. Returns null when the course is unknown -- never guess. */
export function courseBadge(course: Course | null): string | null {
  return course ?? null;
}

/** Parses swim clock input ("2:24.53", "83.45", "30") into milliseconds. Returns null if unparseable. */
export function parseSwimTime(input: string): number | null {
  const trimmed = input.trim();
  const match = /^(?:(\d+):)?(\d{1,2}(?:\.\d+)?)$/.exec(trimmed);
  if (!match) return null;
  const minutes = match[1] ? Number(match[1]) : 0;
  const seconds = Number(match[2]);
  const ms = Math.round((minutes * 60 + seconds) * 1000);
  return ms > 0 ? ms : null;
}

/** Formats milliseconds back into swim clock notation ("2:24.53" or "30.46"). */
export function formatSwimTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds - minutes * 60;
  const secondsStr = seconds.toFixed(2).padStart(5, "0");
  return minutes > 0 ? `${minutes}:${secondsStr}` : seconds.toFixed(2);
}
