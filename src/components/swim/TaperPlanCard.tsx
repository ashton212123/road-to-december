import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { StatusChip, type StatusTone } from "@/components/ui/StatusChip";
import type { TaperPlan } from "@/lib/swim/taper";

const PHASE_LABEL: Record<TaperPlan["phase"], string> = {
  "pre-taper": "Pre-taper",
  taper: "Taper",
  "race-week": "Race week",
  post: "Post-meet",
};

const ADHERENCE_LABEL: Record<TaperPlan["adherence"], { text: string; tone: StatusTone } | null> = {
  "on-plan": { text: "On plan", tone: "ok" },
  "too-much-volume": { text: "Volume above target", tone: "warn" },
  "too-little-intensity": { text: "Quality share below baseline", tone: "warn" },
  unknown: null,
};

function fmtM(m: number): string {
  return `${m.toLocaleString()}m`;
}

/** Live taper plan (loop 37, E1) -- replaces static checklist copy with a
 * computed baseline/target/adherence read against the athlete's own logged
 * volume. Only rendered by callers once a meet is close enough to matter. */
export function TaperPlanCard({ plan, meetName }: { plan: TaperPlan; meetName: string }) {
  const adherence = ADHERENCE_LABEL[plan.adherence];

  return (
    <TerminalPanel variant="open" label={`Taper plan · ${meetName}`} colSpan={12}>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-subhead font-semibold text-[var(--rtd-text)]">
            {PHASE_LABEL[plan.phase]} · {plan.daysOut}d out
          </span>
          {adherence && <StatusChip label={adherence.text} tone={adherence.tone} />}
        </div>

        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${plan.volumeReductionPct}%`, background: "var(--rtd-blue)" }}
          />
        </div>

        <div className="flex items-center justify-between text-footnote">
          <span className="text-[var(--rtd-text-secondary)]">
            Baseline <span className="rtd-mono">{fmtM(plan.baselineWeeklyM)}</span>/wk
          </span>
          <span className="text-[var(--rtd-text)] font-medium">
            Target <span className="rtd-mono">{fmtM(plan.targetWeeklyM)}</span>/wk
          </span>
        </div>

        {plan.thisWeekActualM !== null && (
          <div className="text-footnote text-[var(--rtd-text-secondary)]">
            This week so far: <span className="text-[var(--rtd-text)] font-medium rtd-nums rtd-mono">{fmtM(plan.thisWeekActualM)}</span>
          </div>
        )}

        <p className="text-caption text-[var(--rtd-text-secondary)] leading-snug">{plan.note}</p>
        <p className="text-caption text-[var(--rtd-text-tertiary)] leading-snug">{plan.intensityRule}</p>
        <p className="text-caption text-[var(--rtd-text-tertiary)] leading-snug">{plan.frequencyRule}</p>
      </div>
    </TerminalPanel>
  );
}
