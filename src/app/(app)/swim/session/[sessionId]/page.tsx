import { notFound } from "next/navigation";
import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";
import { BentoCard } from "@/components/ui/BentoCard";
import { MiniBarList } from "@/components/ui/MiniBarList";
import { ZoneDistributionBar, ZONE_ORDER } from "@/components/swim/ZoneDistributionBar";
import { DeleteSessionButton } from "@/components/swim/DeleteSessionButton";
import { getSwimSessionById, getSwimSessionsNear } from "@/lib/db/queries";
import { withRetry } from "@/lib/db/withRetry";
import { classifySession } from "@/lib/swim/sessionType";
import { computeZonePacePer100 } from "@/lib/swim/pace";
import { reconcileDistance } from "@/lib/swim/aiSession";
import { ZONES, type Zone, type ZoneDistance } from "@/lib/swim/zones";
import { evidenceLabel } from "@/lib/swim/evidence";

const ZONE_COLOR_BY_LABEL = Object.fromEntries(ZONE_ORDER.map((z) => [ZONES[z].label, ZONES[z].color]));

function prettyType(type: string): string {
  return type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default async function SwimSessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const id = Number(sessionId);
  if (!Number.isFinite(id)) notFound();

  const session = await withRetry(() => getSwimSessionById(id));
  if (!session) notFound();

  const context = await withRetry(() => getSwimSessionsNear(session.date, session.id));

  const zoneDistance = (session.zoneDistanceM ?? {}) as ZoneDistance;
  const strokeDistance = session.strokeDistanceM ?? {};
  const intervals = session.intervals ?? [];
  const totalM = session.parsedDistanceM ?? 0;

  // Server-side authoritative classification -- same recompute
  // saveSwimSessionAction did, so the label on this page can never drift
  // from what the stored zoneDistanceM actually says.
  const classification = classifySession(zoneDistance, totalM);

  const computedM = intervals.reduce((sum, iv) => sum + iv.reps * iv.distanceM, 0);
  const reconciliation = reconcileDistance(session.statedTotalDistanceM, computedM);

  const zonePace = ZONE_ORDER.filter((z) => (zoneDistance[z] ?? 0) > 0)
    .map((z) => ({ zone: z, paceSecPer100: computeZonePacePer100(intervals, z) }))
    .filter((p): p is { zone: Zone; paceSecPer100: number } => p.paceSecPer100 !== null);

  const analysisParagraphs = (session.aiAnalysis ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const strokeRows = Object.entries(strokeDistance)
    .filter(([, m]) => (m ?? 0) > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  return (
    <div className="flex flex-col gap-4 pt-1">
      <div className="flex items-center justify-between gap-2">
        <Link href="/swim/sessions" className="text-caption text-[var(--rtd-cyan)] cursor-pointer hover:brightness-110">
          ← All sessions
        </Link>
        {session.course && (
          <span className="text-caption font-semibold px-2 py-0.5 rounded-full bg-white/[0.08] text-[var(--rtd-text-secondary)]">
            {session.course}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <SectionLabel>{formatDate(session.date)}</SectionLabel>
        <p className="text-subhead text-[var(--rtd-text)] font-semibold">{classification.label}</p>
        <p className="text-caption text-[var(--rtd-text-secondary)]">{classification.why}</p>
      </div>

      <GlassCard className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-title-2 font-semibold text-[var(--rtd-text)] rtd-nums">
            {totalM > 0 ? `${totalM.toLocaleString()}m` : "—"}
          </span>
          <div className="flex items-center gap-3 text-footnote text-[var(--rtd-text-secondary)] rtd-nums">
            {session.durationMin !== null && <span>{session.durationMin} min</span>}
            {session.sessionRpe !== null && <span>RPE {Number(session.sessionRpe)}/10</span>}
          </div>
        </div>
        {reconciliation.message && <p className="text-caption text-[var(--rtd-orange)]">{reconciliation.message}</p>}
      </GlassCard>

      {context.length > 0 && (
        <div>
          <SectionLabel>This week</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {context.map((c) => (
              <span key={c.id} className="text-caption px-2 py-1 rounded-full bg-white/[0.06] text-[var(--rtd-text-secondary)] rtd-nums">
                {c.date.slice(5)} · {c.sessionType ? prettyType(c.sessionType) : "—"}
              </span>
            ))}
          </div>
        </div>
      )}

      <BentoCard variant="open" label="Zone distribution" colSpan={12}>
        {totalM > 0 && ZONE_ORDER.some((z) => (zoneDistance[z] ?? 0) > 0) ? (
          <div className="flex flex-col gap-3">
            <ZoneDistributionBar zoneDistance={zoneDistance} totalM={totalM} />
            <MiniBarList
              rows={ZONE_ORDER.filter((z) => (zoneDistance[z] ?? 0) > 0).map((z) => ({ label: ZONES[z].label, value: Math.round(zoneDistance[z] ?? 0) }))}
              colorFor={(r) => ZONE_COLOR_BY_LABEL[r.label] ?? "var(--rtd-cyan)"}
              formatValue={(v) => `${v}m`}
            />
          </div>
        ) : (
          <p className="text-caption text-[var(--rtd-text-tertiary)]">No zone breakdown logged for this session.</p>
        )}
      </BentoCard>

      <BentoCard variant="open" label="Stroke distribution" colSpan={12}>
        {strokeRows.length > 0 ? (
          <>
            <MiniBarList rows={strokeRows} color="var(--rtd-cyan)" formatValue={(v) => `${v}m`} />
            {session.breastKickM !== null && session.breastKickM > 0 && (
              <p className="text-caption text-[var(--rtd-text-tertiary)] mt-2">
                Includes {session.breastKickM}m breaststroke kick — {evidenceLabel("E4")}.
              </p>
            )}
          </>
        ) : (
          <p className="text-caption text-[var(--rtd-text-tertiary)]">No stroke breakdown logged for this session.</p>
        )}
      </BentoCard>

      <BentoCard variant="open" label="Pace by zone" colSpan={12}>
        {zonePace.length > 0 ? (
          <div className="flex flex-col gap-2">
            <MiniBarList
              rows={zonePace.map((p) => ({ label: ZONES[p.zone].label, value: Math.round(p.paceSecPer100 * 10) / 10 }))}
              color="var(--rtd-blue)"
              formatValue={(v) => `${v.toFixed(1)}s`}
            />
            <p className="text-caption text-[var(--rtd-text-tertiary)]">Per-zone pace only — never averaged across zones.</p>
          </div>
        ) : (
          <p className="text-caption text-[var(--rtd-text-tertiary)]">No timed intervals logged for this session.</p>
        )}
      </BentoCard>

      <div>
        <SectionLabel>Analysis</SectionLabel>
        <GlassCard className="flex flex-col gap-2.5">
          {analysisParagraphs.length > 0 ? (
            analysisParagraphs.map((p, i) => (
              <p key={i} className="text-subhead text-[var(--rtd-text)] leading-snug">
                {p}
              </p>
            ))
          ) : (
            <p className="text-caption text-[var(--rtd-text-tertiary)]">No analysis available for this session.</p>
          )}
        </GlassCard>
      </div>

      {intervals.length > 0 && (
        <div>
          <SectionLabel>Sets</SectionLabel>
          <GlassCard variant="open" className="flex flex-col rtd-divide-y">
            {intervals.map((iv, i) => {
              const zoneMeta = iv.zone ? ZONES[iv.zone as Zone] : undefined;
              return (
                <div key={i} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                  <span className="text-subhead rtd-nums text-[var(--rtd-text)]">
                    {iv.reps > 1 ? `${iv.reps}×${iv.distanceM}` : iv.distanceM}m {iv.stroke}
                    {iv.targetInterval ? ` @${iv.targetInterval}` : ""}
                  </span>
                  {zoneMeta && (
                    <span
                      className="text-caption font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: `color-mix(in srgb, ${zoneMeta.color} 18%, transparent)`, color: zoneMeta.color }}
                    >
                      {zoneMeta.zone}
                    </span>
                  )}
                  {iv.note && <span className="text-caption text-[var(--rtd-text-tertiary)] truncate">{iv.note}</span>}
                  <span className="flex-1" />
                  {iv.avgTime && <span className="text-footnote rtd-nums text-[var(--rtd-cyan)] shrink-0">avg {iv.avgTime}</span>}
                </div>
              );
            })}
          </GlassCard>
        </div>
      )}

      <DeleteSessionButton sessionId={session.id} />
    </div>
  );
}
