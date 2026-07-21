/** Context-aware quick prompts shown in the Coach panel/tab, keyed by the
 * current route so the same three chips aren't shown everywhere. One write
 * prompt per surface now that the coach can actually log/edit (P6) --
 * these double as a discoverability hint that typing an instruction works,
 * not just questions. */
export function quickPromptsForPath(pathname: string): string[] {
  if (pathname.startsWith("/fuel")) {
    return ["Log 1L of water", "What should I eat for the rest of today?", "Am I hitting my protein target?"];
  }
  if (pathname.startsWith("/train")) {
    return ["Log my last set", "Should I go heavier today?", "What should I focus on in today's session?"];
  }
  if (pathname.startsWith("/swim")) {
    return ["Log today's swim: ", "Am I on track for my next meet?", "What should today's set focus on?"];
  }
  if (pathname.startsWith("/analytics")) {
    return ["Why am I plateauing?", "Which lift needs the most attention?", "Am I on track for my next meet?"];
  }
  if (pathname.startsWith("/home") || pathname === "/") {
    return ["What have I logged today?", "How ready am I this week?", "What's my biggest gap right now?"];
  }
  return ["How's my training this week?", "What should I focus on today?", "Anything I'm missing?"];
}
