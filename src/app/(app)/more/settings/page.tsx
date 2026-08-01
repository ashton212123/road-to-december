import { SectionHeader } from "@/components/ui/SectionHeader";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { SettingsForm } from "@/components/more/SettingsForm";
import { TrainingStatusControl } from "@/components/more/TrainingStatusControl";
import { CoachMemoryEditor } from "@/components/more/CoachMemoryEditor";
import { HabitEditor } from "@/components/more/HabitEditor";
import { getSettingsRow } from "@/lib/db/queries";
import { withRetry } from "@/lib/db/withRetry";
import { withFallback } from "@/lib/db/withFallback";
import { getAthleteModel } from "@/lib/coach/athleteModel";
import { getAllHabitsForEditor } from "@/lib/habits/queries";
import { FALLBACK_SETTINGS } from "@/lib/coach/context";

export default async function SettingsPage() {
  const [settingsRow, athleteModel, allHabits] = await Promise.all([
    withFallback(withRetry(() => getSettingsRow(), { label: "Settings: settings row" }), FALLBACK_SETTINGS),
    withFallback(withRetry(() => getAthleteModel(), { label: "Settings: athlete model" }), null),
    withFallback(withRetry(() => getAllHabitsForEditor(), { label: "Settings: habits editor list" }), []),
  ]);

  return (
    <div className="flex flex-col gap-4 pt-1 md:max-w-2xl md:mx-auto">
      <SectionHeader title="Settings" className="mb-2" />
      <TerminalPanel>
        <TrainingStatusControl current={settingsRow.trainingStatus} />
      </TerminalPanel>
      <SettingsForm
        initialAsean={settingsRow.aseanConfirmed}
        initialWaterTargetMl={settingsRow.waterTargetMl}
        initialWeightUnit={settingsRow.weightUnit as "kg" | "lb"}
      />

      <SectionHeader title="Habits" className="mb-2" />
      <TerminalPanel>
        <HabitEditor habits={allHabits} />
      </TerminalPanel>

      <SectionHeader title="Coach memory" className="mb-2" />
      <TerminalPanel>
        <CoachMemoryEditor initialModel={athleteModel} />
      </TerminalPanel>

      <SectionHeader title="Connect Claude via MCP" className="mb-2" />
      <TerminalPanel className="gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--rtd-green)]" />
          <span className="text-body font-semibold">MCP server live at /api/mcp</span>
        </div>
        <p className="text-subhead text-[var(--rtd-text-secondary)] leading-relaxed">
          This app exposes a remote MCP server so your own Claude subscription can act as its AI
          layer — no API key lives in this codebase. Add it to claude.ai as a custom connector to
          let Claude read your dashboard, log food/water/sleep/weigh-ins/sets, and log swim times
          or CMJ tests, all in chat. For quick questions or in-app coaching, use the Coach tab
          instead — it&apos;s built into this app directly.
        </p>
        <ol className="text-subhead text-[var(--rtd-text-secondary)] flex flex-col gap-1.5 list-decimal list-inside">
          <li>In claude.ai, go to Settings → Connectors → Add custom connector.</li>
          <li>
            URL: <code className="text-[var(--rtd-cyan)]">https://your-deployment.vercel.app/api/mcp</code>
          </li>
          <li>
            Auth header: <code className="text-[var(--rtd-cyan)]">Authorization: Bearer &lt;MCP_BEARER_TOKEN&gt;</code> —
            the same value you set in this app&apos;s environment variables.
          </li>
          <li>Save, then ask Claude to check your dashboard or log something.</li>
        </ol>
        <p className="text-footnote text-[var(--rtd-text-tertiary)]">
          Full setup steps, including how to generate the bearer token, are in DEPLOY.md.
        </p>
      </TerminalPanel>
    </div>
  );
}
