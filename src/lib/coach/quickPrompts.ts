/** Context-aware quick prompts shown in the Coach panel/tab, keyed by the
 * current route so the same three chips aren't shown everywhere. */
export function quickPromptsForPath(pathname: string): string[] {
  if (pathname.startsWith("/fuel")) {
    return ["What should I eat for the rest of today?", "Am I hitting my protein target?", "How's my adherence this week?"];
  }
  if (pathname.startsWith("/train")) {
    return ["Should I go heavier today?", "What should I focus on in today's session?", "Am I recovering enough between sessions?"];
  }
  if (pathname.startsWith("/analytics")) {
    return ["Why am I plateauing?", "Which lift needs the most attention?", "Am I on track for my next meet?"];
  }
  if (pathname.startsWith("/home") || pathname === "/") {
    return ["How ready am I this week?", "What's my biggest gap right now?", "How's my consistency lately?"];
  }
  return ["How's my training this week?", "What should I focus on today?", "Anything I'm missing?"];
}
