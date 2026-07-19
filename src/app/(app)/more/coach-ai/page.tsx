import { SectionLabel } from "@/components/ui/SectionLabel";
import { CoachChat } from "@/components/coach/CoachChat";
import { getRecentCoachMessages } from "@/lib/coach/messages";
import { getCoachAppContext } from "@/lib/coach/context";
import { withRetry } from "@/lib/db/withRetry";

function buildQuickPrompts(ctx: Awaited<ReturnType<typeof getCoachAppContext>>): string[] {
  const prompts: string[] = [];
  if (ctx.todaySessionTitle) prompts.push(`What should I focus on in today's ${ctx.todaySessionTitle}?`);
  const nextMeet = ctx.upcomingMeets[0];
  if (nextMeet) {
    const worst = [...nextMeet.events].sort((a, b) => (b.gapToTargetMs ?? 0) - (a.gapToTargetMs ?? 0))[0];
    if (worst) prompts.push(`Am I on track for ${worst.event} at ${nextMeet.name}?`);
  }
  prompts.push(`How's my nutrition looking today?`);
  prompts.push(`How's my training streak and recovery?`);
  return prompts.slice(0, 4);
}

export default async function CoachAiPage() {
  const [initialMessages, appContext] = await withRetry(() =>
    Promise.all([getRecentCoachMessages(20), getCoachAppContext()])
  );

  return (
    <div className="flex flex-col gap-3 rtd-fade-in pt-1 h-[calc(100dvh-8.5rem)] md:h-[calc(100dvh-6rem)] md:max-w-2xl md:mx-auto">
      <SectionLabel>Coach</SectionLabel>
      <CoachChat
        initialMessages={initialMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))}
        quickPrompts={buildQuickPrompts(appContext)}
      />
    </div>
  );
}
