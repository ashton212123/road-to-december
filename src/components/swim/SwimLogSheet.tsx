"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { Button } from "@/components/ui/Button";
import { ZONES, breastKickMetres, type Zone, type ZoneDistance } from "@/lib/swim/zones";
import { classifySession } from "@/lib/swim/sessionType";
import { reconcileDistance, type AiSwimInterval, type AiSwimSession } from "@/lib/swim/aiSession";
import type { Course } from "@/lib/swim/course";
import type { SwimSessionInterval } from "@/lib/db/schema";
import { analyzeSwimSessionAction, saveSwimSessionAction } from "@/app/(app)/swim/actions";

const RPE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ZONE_OPTIONS: Zone[] = ["REC", "EN1", "EN2", "EN3", "SP1", "SP2", "SP3", "TECH"];

function normalizeStrokeLabel(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.startsWith("br") || s === "breast") return "Breast";
  if (s.startsWith("fr") || s === "free") return "Free";
  if (s.startsWith("bk") || s === "back") return "Back";
  if (s.startsWith("fl") || s === "fly") return "Fly";
  if (s === "im" || s === "medley") return "IM";
  return raw;
}

function buildZoneDistance(intervals: AiSwimInterval[]): ZoneDistance {
  const zd: ZoneDistance = {};
  for (const iv of intervals) {
    const m = iv.reps * iv.distanceM;
    zd[iv.zone] = (zd[iv.zone] ?? 0) + m;
  }
  return zd;
}

function buildStrokeDistance(intervals: AiSwimInterval[]): Record<string, number> {
  const sd: Record<string, number> = {};
  for (const iv of intervals) {
    const label = normalizeStrokeLabel(iv.stroke);
    sd[label] = (sd[label] ?? 0) + iv.reps * iv.distanceM;
  }
  return sd;
}

function buildSetsText(intervals: AiSwimInterval[]): string {
  return intervals
    .map(
      (iv) =>
        `${iv.note ? `${iv.note} ` : ""}${iv.reps}x${iv.distanceM} ${iv.stroke}${iv.targetInterval ? ` @${iv.targetInterval}` : ""}`
    )
    .join(", ");
}

function toSessionInterval(iv: AiSwimInterval): SwimSessionInterval {
  return {
    reps: iv.reps,
    distanceM: iv.distanceM,
    stroke: iv.stroke,
    targetInterval: iv.targetInterval,
    avgTime: iv.avgTime,
    note: iv.note,
    zone: iv.zone,
    isKick: iv.isKick,
    isPull: iv.isPull,
    isDrill: iv.isDrill,
  };
}

/** The Log view's entry point (and the swim-delegate target from
 * ImportSessionButton): describe a session in your own words, one Groq call
 * structures it into zoned intervals, review before it saves. Replaces
 * SwimLogHero + SwimSessionLogger + the regex distance estimator entirely. */
export function SwimLogSheet({
  embedded = false,
  initialText,
  autoAnalyze = false,
  onSaved,
}: {
  /** No outer card chrome / own header -- used inside ImportSessionButton's dialog. */
  embedded?: boolean;
  initialText?: string;
  autoAnalyze?: boolean;
  onSaved?: () => void;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [ai, setAi] = useState<AiSwimSession | null>(null);
  const [intervals, setIntervals] = useState<AiSwimInterval[]>([]);
  const [durationMin, setDurationMin] = useState<number | "">("");
  const [sessionRpe, setSessionRpe] = useState<number | null>(null);
  const [course, setCourse] = useState<Course>("SCM");
  const [notable, setNotable] = useState<{ event: string; timeMs: number; isRace: boolean; include: boolean }[]>([]);
  const [expandedZone, setExpandedZone] = useState<Zone | null>(null);
  const [status, setStatus] = useState<"idle" | "error" | "reviewing" | "saved">("idle");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDistanceM, setManualDistanceM] = useState("");
  const [manualDurationMin, setManualDurationMin] = useState("");
  const [manualRpe, setManualRpe] = useState<number | null>(null);

  const [analyzing, startAnalyze] = useTransition();
  const [saving, startSave] = useTransition();
  const [savingManual, startSaveManual] = useTransition();

  function runAnalyze(source: string) {
    if (!source.trim()) return;
    startAnalyze(async () => {
      const result = await analyzeSwimSessionAction(source);
      if (!result) {
        setStatus("error");
        return;
      }
      setAi(result);
      setIntervals(result.intervals);
      setDurationMin(result.durationMin ?? "");
      setSessionRpe(result.sessionRpe);
      setCourse(result.course ?? "SCM");
      setNotable(result.notable.map((n) => ({ ...n, include: true })));
      setStatus("reviewing");
    });
  }

  useEffect(() => {
    if (autoAnalyze && initialText && status === "idle") {
      runAnalyze(initialText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const computedTotalDistanceM = useMemo(() => intervals.reduce((s, iv) => s + iv.reps * iv.distanceM, 0), [intervals]);
  const reconciliation = useMemo(
    () => reconcileDistance(ai?.statedTotalDistanceM ?? null, computedTotalDistanceM),
    [ai, computedTotalDistanceM]
  );
  const zoneDistanceM = useMemo(() => buildZoneDistance(intervals), [intervals]);
  const strokeDistanceM = useMemo(() => buildStrokeDistance(intervals), [intervals]);
  const classification = useMemo(
    () => classifySession(zoneDistanceM, reconciliation.finalM),
    [zoneDistanceM, reconciliation.finalM]
  );
  const breastKickM = useMemo(() => breastKickMetres(intervals.map(toSessionInterval)), [intervals]);

  function updateInterval(i: number, patch: Partial<AiSwimInterval>) {
    setIntervals((prev) => prev.map((iv, idx) => (idx === i ? { ...iv, ...patch } : iv)));
  }

  function save() {
    if (intervals.length === 0 || durationMin === "" || sessionRpe === null) return;
    startSave(async () => {
      await saveSwimSessionAction({
        intervals: intervals.map(toSessionInterval),
        zoneDistanceM: zoneDistanceM as Record<string, number>,
        strokeDistanceM,
        statedTotalDistanceM: ai?.statedTotalDistanceM ?? null,
        finalTotalDistanceM: reconciliation.finalM,
        breastKickM,
        sessionType: classification.type,
        durationMin: Number(durationMin),
        sessionRpe,
        course,
        setsText: buildSetsText(intervals),
        aiSummary: ai?.summary ?? null,
        notable: notable.filter((n) => n.include).map(({ event, timeMs, isRace }) => ({ event, timeMs, isRace })),
      });
      setStatus("saved");
      onSaved?.();
    });
  }

  function saveManual() {
    const distanceM = Number(manualDistanceM);
    const duration = Number(manualDurationMin);
    if (!distanceM || distanceM <= 0 || !duration || duration <= 0 || manualRpe === null) return;
    startSaveManual(async () => {
      const manualIntervals: AiSwimInterval[] = [
        { reps: 1, distanceM, stroke: "unspecified", zone: "EN1", isKick: false, isPull: false, isDrill: false },
      ];
      const zd = buildZoneDistance(manualIntervals);
      const cls = classifySession(zd, distanceM);
      await saveSwimSessionAction({
        intervals: manualIntervals.map(toSessionInterval),
        zoneDistanceM: zd as Record<string, number>,
        strokeDistanceM: { unspecified: distanceM },
        statedTotalDistanceM: distanceM,
        finalTotalDistanceM: distanceM,
        breastKickM: 0,
        sessionType: cls.type,
        durationMin: duration,
        sessionRpe: manualRpe,
        course: "SCM",
        setsText: text.trim() || `${distanceM}m logged without AI structuring`,
        aiSummary: null,
        notable: [],
      });
      setStatus("saved");
      onSaved?.();
    });
  }

  if (status === "saved") {
    return embedded ? null : (
      <TerminalPanel fill={false} className="items-center py-6 text-center">
        <div className="text-title-3">Session saved</div>
      </TerminalPanel>
    );
  }

  const body = (
    <div className="flex flex-col gap-3">
      {status === "idle" || status === "error" ? (
        <>
          {status === "error" && (
            <div className="rtd-strip" style={{ background: "rgba(255,159,10,0.12)", color: "var(--rtd-orange)" }}>
              Couldn&apos;t reach the AI — try again, or log without it below.
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="How was the session? Describe it however you'd tell a teammate — 'warm up 400, 8x50 breast at 1:10 holding 38, 4.5k total, felt like a 7'"
            className="rounded-lg bg-white/[0.06] px-3 py-2 text-subhead outline-none resize-none"
            autoFocus={!embedded}
          />
          <Button onClick={() => runAnalyze(text)} disabled={analyzing || !text.trim()}>
            {analyzing ? "Reading it…" : "Analyze session"}
          </Button>

          {manualOpen ? (
            <div className="flex flex-col gap-2 rounded-lg bg-white/[0.04] p-3">
              <div className="rtd-micro-label">Log without AI</div>
              <input
                type="number"
                placeholder="Total distance (m)"
                value={manualDistanceM}
                onChange={(e) => setManualDistanceM(e.target.value)}
                className="rounded bg-white/[0.06] px-2 py-1.5 text-subhead outline-none rtd-nums"
              />
              <input
                type="number"
                placeholder="Duration (min)"
                value={manualDurationMin}
                onChange={(e) => setManualDurationMin(e.target.value)}
                className="rounded bg-white/[0.06] px-2 py-1.5 text-subhead outline-none rtd-nums"
              />
              <div className="grid grid-cols-5 gap-1.5">
                {RPE_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setManualRpe(r)}
                    className="rtd-tap-target py-1.5 rounded-lg text-caption font-semibold cursor-pointer"
                    style={{
                      background: manualRpe === r ? "rgba(90,200,250,0.18)" : "rgba(255,255,255,0.06)",
                      border: manualRpe === r ? "1px solid var(--rtd-cyan)" : "1px solid transparent",
                      color: manualRpe === r ? "var(--rtd-cyan)" : "var(--rtd-text-secondary)",
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <Button
                variant="secondary"
                onClick={saveManual}
                disabled={savingManual || !manualDistanceM || !manualDurationMin || manualRpe === null}
              >
                {savingManual ? "Saving…" : "Save"}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className="rtd-tap-target text-caption text-[var(--rtd-text-tertiary)] cursor-pointer hover:text-[var(--rtd-text-secondary)] self-start"
            >
              Log without AI
            </button>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="text-subhead font-semibold">{classification.label}</span>
          </div>
          <p className="text-caption text-[var(--rtd-text-secondary)]">{classification.why}</p>

          {reconciliation.needsReview && reconciliation.message && (
            <div className="rtd-strip" style={{ background: "rgba(255,159,10,0.12)", color: "var(--rtd-orange)" }}>
              {reconciliation.message}
            </div>
          )}
          <div className="text-title-1 rtd-nums rtd-mono">{reconciliation.finalM.toLocaleString()}m</div>

          <div className="flex flex-col gap-1.5">
            <div className="flex h-3 rounded-full overflow-hidden">
              {ZONE_OPTIONS.filter((z) => (zoneDistanceM[z] ?? 0) > 0).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setExpandedZone((prev) => (prev === z ? null : z))}
                  className="rtd-tap-target"
                  style={{
                    width: `${((zoneDistanceM[z] ?? 0) / Math.max(1, computedTotalDistanceM)) * 100}%`,
                    background: ZONES[z].color,
                    opacity: expandedZone === null || expandedZone === z ? 1 : 0.45,
                  }}
                  aria-label={`${z}: ${zoneDistanceM[z]}m`}
                />
              ))}
            </div>
            {expandedZone && (
              <div className="rounded-lg bg-white/[0.04] p-2.5 flex flex-col gap-1 text-caption">
                <span className="font-semibold" style={{ color: ZONES[expandedZone].color }}>
                  {ZONES[expandedZone].label} ({zoneDistanceM[expandedZone]?.toLocaleString()}m)
                </span>
                <span className="text-[var(--rtd-text-secondary)]">{ZONES[expandedZone].purpose}</span>
                <span className="text-[var(--rtd-text-tertiary)]">Use: {ZONES[expandedZone].whenToUse}</span>
                <span className="text-[var(--rtd-text-tertiary)]">Not: {ZONES[expandedZone].whenNotToUse}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            {intervals.map((iv, i) => (
              <div key={i} className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] p-2 flex-wrap">
                <input
                  type="number"
                  value={iv.reps}
                  onChange={(e) => updateInterval(i, { reps: Number(e.target.value) || 0 })}
                  className="w-12 rounded bg-white/[0.06] px-1.5 py-1 text-caption outline-none rtd-nums"
                />
                <span className="text-caption text-[var(--rtd-text-tertiary)]">x</span>
                <input
                  type="number"
                  value={iv.distanceM}
                  onChange={(e) => updateInterval(i, { distanceM: Number(e.target.value) || 0 })}
                  className="w-14 rounded bg-white/[0.06] px-1.5 py-1 text-caption outline-none rtd-nums"
                />
                <input
                  type="text"
                  value={iv.stroke}
                  onChange={(e) => updateInterval(i, { stroke: e.target.value })}
                  className="w-20 rounded bg-white/[0.06] px-1.5 py-1 text-caption outline-none"
                />
                <select
                  value={iv.zone}
                  onChange={(e) => updateInterval(i, { zone: e.target.value as Zone })}
                  className="rounded bg-white/[0.06] px-1.5 py-1 text-caption outline-none"
                  style={{ color: ZONES[iv.zone].color }}
                >
                  {ZONE_OPTIONS.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={iv.avgTime ?? ""}
                  placeholder="avg"
                  onChange={(e) => updateInterval(i, { avgTime: e.target.value || undefined })}
                  className="w-14 rounded bg-white/[0.06] px-1.5 py-1 text-caption outline-none"
                />
                {iv.note && (
                  <span className="text-caption px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[var(--rtd-text-tertiary)] shrink-0">
                    {iv.note}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIntervals((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label="Remove interval"
                  className="rtd-tap-target ml-auto text-[var(--rtd-text-tertiary)] cursor-pointer hover:text-[var(--rtd-red)] shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {breastKickM > 0 && (
            <div className="text-caption text-[var(--rtd-text-secondary)]">
              Breaststroke kick: <span className="rtd-nums rtd-mono font-semibold">{breastKickM.toLocaleString()}m</span> this session
              [moderate — breaststroker&apos;s knee tracks kick volume]
            </div>
          )}

          {notable.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="rtd-micro-label">Also log as a time</div>
              {notable.map((n, i) => (
                <label key={i} className="rtd-tap-target flex items-center gap-2 text-caption text-[var(--rtd-text-secondary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={n.include}
                    onChange={(e) => setNotable((prev) => prev.map((p, idx) => (idx === i ? { ...p, include: e.target.checked } : p)))}
                  />
                  {n.event} — <span className="rtd-mono">{(n.timeMs / 1000).toFixed(2)}s</span>{n.isRace ? " (race)" : ""}
                </label>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-caption text-[var(--rtd-text-secondary)]">How hard was that, overall?</span>
            <span className="text-caption text-[var(--rtd-text-tertiary)]">Rate the whole session, not the hardest set.</span>
            <div className="grid grid-cols-5 gap-1.5">
              {RPE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSessionRpe(r)}
                  className="rtd-tap-target py-1.5 rounded-lg text-caption font-semibold cursor-pointer"
                  style={{
                    background: sessionRpe === r ? "rgba(90,200,250,0.18)" : "rgba(255,255,255,0.06)",
                    border: sessionRpe === r ? "1px solid var(--rtd-cyan)" : "1px solid transparent",
                    color: sessionRpe === r ? "var(--rtd-cyan)" : "var(--rtd-text-secondary)",
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-caption text-[var(--rtd-text-secondary)]">Duration (min)</span>
            <input
              type="number"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-16 rounded bg-white/[0.06] px-1.5 py-1 text-caption outline-none rtd-nums"
            />
          </div>

          <Button onClick={save} disabled={saving || intervals.length === 0 || durationMin === "" || sessionRpe === null}>
            {saving ? "Saving…" : "Save session"}
          </Button>
        </>
      )}
    </div>
  );

  if (embedded) return body;

  return (
    <TerminalPanel fill={false}>
      <div className="text-title-3">Log a swim</div>
      {body}
    </TerminalPanel>
  );
}
