import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";

export default function CoachAiPage() {
  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1">
      <SectionLabel>Coach AI</SectionLabel>
      <GlassCard className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--rtd-green)]" />
          <span className="text-sm font-semibold">MCP server live at /api/mcp</span>
        </div>
        <p className="text-xs text-[var(--rtd-text-secondary)] leading-relaxed">
          This app exposes a remote MCP server so your own Claude subscription can act as its AI
          layer — no API key lives in this codebase. Add it to claude.ai as a custom connector to
          let Claude read your dashboard, log food/water/sleep/weigh-ins/sets, and log swim times
          or CMJ tests, all in chat.
        </p>
        <ol className="text-xs text-[var(--rtd-text-secondary)] flex flex-col gap-1.5 list-decimal list-inside">
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
        <p className="text-[10px] text-[var(--rtd-text-tertiary)]">
          Full setup steps, including how to generate the bearer token, are in DEPLOY.md.
        </p>
      </GlassCard>
    </div>
  );
}
