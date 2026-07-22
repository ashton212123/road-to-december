import Link from "next/link";
import { BentoCard } from "@/components/ui/BentoCard";
import { ImportSessionButton } from "@/components/train/ImportSessionButton";
import { formatSwimTime } from "@/lib/swim/format";
import type { SwimSessionInterval } from "@/lib/db/schema";
import type { ReadinessResult } from "@/lib/swim/readiness";

// The swim-training trio: weekly volume, month dot calendar, latest imported
// session breakdown. First components on the liquid-gradient direction --
// gradient fills + soft glow instead of flat accent colors (kept to
// background/box-shadow so the perf rules hold: no backdrop-filter, no
// animated filters).
const SWIM_GRADIENT = "linear-gradient(90deg, #22d3ee 0%, #818cf8 100%)";
const GLOW = "0 0 10px rgba(34,211,238,0.45)";

export type SwimWeek = { weekStart: string; distanceM: number; sessions: number; loadSum: number };

function fmtKm(m: number): string {
  return m > 0 ? `${(m / 1000).toFixed(1)}km` : "—";
}

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function SwimWeeklyVolumeCard({ weeks }: { weeks: SwimWeek[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.distanceM));
  const hasAny = weeks.some((w) => w.sessions > 0);
  return (
    <BentoCard label="Weekly swim volume" colSpan={6}>
      {!hasAny ? (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-caption text-[var(--rtd-text-tertiary)]">Import or log a swim session and weekly volume starts tracking here.</p>
          <ImportSessionButton phaseId={null} todayExercises={[]} compact />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {weeks.map((w) => (
            <div key={w.weekStart} className="flex items-center gap-2.5">
              <span className="w-24 shrink-0 text-footnote text-[var(--rtd-text-secondary)] truncate">
                {shortDate(w.weekStart)}
                {w.sessions > 0 && <span className="text-[var(--rtd-text-tertiary)]"> · {w.sessions}x</span>}
              </span>
              <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(w.distanceM > 0 ? 4 : 0, (w.distanceM / max) * 100)}%`,
                    background: SWIM_GRADIENT,
                    boxShadow: w.distanceM > 0 ? GLOW : undefined,
                  }}
                />
              </div>
              <span className="w-14 shrink-0 text-footnote text-right text-[var(--rtd-text)] rtd-nums">{fmtKm(w.distanceM)}</span>
            </div>
          ))}
        </div>
      )}
    </BentoCard>
  );
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

// Load buckets for the dot calendar. Distance-based; sessions without a
// parsed distance still show as "light" so a manually logged swim never
// renders as a rest day.
function bucketFor(distanceM: number, sessions: number): 0 | 1 | 2 | 3 {
  if (sessions === 0) return 0;
  if (distanceM >= 4000) return 3;
  if (distanceM >= 2000) return 2;
  return 1;
}

const BUCKET_STYLE: Record<1 | 2 | 3, { background: string; boxShadow?: string }> = {
  1: { background: "rgba(34,211,238,0.35)" },
  2: { background: "linear-gradient(135deg, rgba(34,211,238,0.75), rgba(129,140,248,0.75))" },
  3: { background: "linear-gradient(135deg, #22d3ee, #818cf8)", boxShadow: GLOW },
};

const LEGEND: { label: string; bucket: 0 | 1 | 2 | 3 }[] = [
  { label: "Rest", bucket: 0 },
  { label: "<2k", bucket: 1 },
  { label: "2–4k", bucket: 2 },
  { label: "4k+", bucket: 3 },
];

export function SwimMonthDotsCard({
  monthStartISO,
  today,
  sessions,
}: {
  monthStartISO: string;
  today: string;
  sessions: { date: string; parsedDistanceM: number | null }[];
}) {
  const byDate = new Map<string, { distanceM: number; sessions: number }>();
  for (const s of sessions) {
    if (!s.date.startsWith(monthStartISO.slice(0, 7))) continue;
    const cur = byDate.get(s.date) ?? { distanceM: 0, sessions: 0 };
    cur.distanceM += s.parsedDistanceM ?? 0;
    cur.sessions += 1;
    byDate.set(s.date, cur);
  }

  const monthStart = new Date(`${monthStartISO}T00:00:00`);
  const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const leadingBlanks = (monthStart.getDay() + 6) % 7; // Monday-first
  const ym = monthStartISO.slice(0, 7);

  return (
    <BentoCard label={`Swim month · ${monthLabel}`} colSpan={6}>
      <div className="grid grid-cols-7 gap-1.5 justify-items-center">
        {WEEKDAYS.map((d, i) => (
          <span key={`h${i}`} className="text-caption text-[var(--rtd-text-tertiary)]">
            {d}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const dateISO = `${ym}-${String(i + 1).padStart(2, "0")}`;
          const day = byDate.get(dateISO) ?? { distanceM: 0, sessions: 0 };
          const bucket = bucketFor(day.distanceM, day.sessions);
          const isToday = dateISO === today;
          return (
            <span
              key={dateISO}
              title={day.sessions > 0 ? `${dateISO}: ${fmtKm(day.distanceM)}` : dateISO}
              className="w-3 h-3 rounded-full"
              style={{
                ...(bucket === 0 ? { background: "rgba(255,255,255,0.06)" } : BUCKET_STYLE[bucket]),
                outline: isToday ? "1.5px solid rgba(255,255,255,0.55)" : undefined,
                outlineOffset: 1.5,
              }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-caption text-[var(--rtd-text-secondary)]">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={l.bucket === 0 ? { background: "rgba(255,255,255,0.06)" } : BUCKET_STYLE[l.bucket]}
            />
            {l.label}
          </span>
        ))}
      </div>
    </BentoCard>
  );
}

export function SwimLatestSessionCard({
  session,
}: {
  session: { date: string; parsedDistanceM: number | null; setsText: string | null; intervals: SwimSessionInterval[] | null } | null;
}) {
  return (
    <BentoCard label="Latest imported session" colSpan={12}>
      {!session || !session.intervals || session.intervals.length === 0 ? (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-caption text-[var(--rtd-text-tertiary)]">
            Paste a session and its interval breakdown lands here.
          </p>
          <ImportSessionButton phaseId={null} todayExercises={[]} compact />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-subhead font-medium text-[var(--rtd-text)]">{shortDate(session.date)}</span>
            {session.parsedDistanceM !== null && (
              <span className="text-subhead rtd-nums text-[var(--rtd-text-secondary)]">{fmtKm(session.parsedDistanceM)} total</span>
            )}
          </div>
          <div className="flex flex-col rtd-divide-y">
            {session.intervals.map((iv, i) => {
              const warmish = iv.note && /w\/?u|w\/?d|drill/i.test(iv.note);
              return (
                <div key={i} className="flex items-center gap-2 py-1.5 first:pt-0 last:pb-0">
                  <span
                    className="text-subhead rtd-nums"
                    style={{ color: warmish ? "var(--rtd-text-tertiary)" : "var(--rtd-text)" }}
                  >
                    {iv.reps > 1 ? `${iv.reps}×${iv.distanceM}` : iv.distanceM}m {iv.stroke}
                    {iv.targetInterval ? ` @${iv.targetInterval}` : ""}
                  </span>
                  {iv.note && <span className="text-caption text-[var(--rtd-text-tertiary)]">{iv.note}</span>}
                  <span className="flex-1" />
                  {iv.avgTime && <span className="text-footnote rtd-nums text-[var(--rtd-cyan)]">avg {iv.avgTime}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </BentoCard>
  );
}

export type MeetReadinessMeet = {
  id: number;
  name: string;
  date: string;
  events: {
    id: number;
    event: string;
    targetTimeMs: number;
    readiness: Pick<ReadinessResult, "currentBestMs" | "confidence" | "practiceBestMs" | "practiceTrendMsPerWeek">;
  }[];
};

function formatTrend(msPerWeek: number): string {
  const sec = Math.abs(msPerWeek / 1000).toFixed(1);
  return msPerWeek < 0 ? `−${sec}s/wk` : `+${sec}s/wk`;
}

function daysOut(todayISO: string, dateISO: string): number {
  const from = new Date(`${todayISO}T00:00:00Z`).getTime();
  const to = new Date(`${dateISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

// Same visual language as DeltaChip (solid pill, dark text -- a stamped
// verdict, not a tint) but for a raw time gap instead of a percentage:
// negative/zero (at or under target) reads green, still-slower reads red.
function GapChip({ gapMs }: { gapMs: number | null }) {
  if (gapMs === null) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-white/[0.06] text-[var(--rtd-text-tertiary)] rtd-nums text-caption">
        —
      </span>
    );
  }
  const isAhead = gapMs <= 0;
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full font-semibold rtd-nums text-caption"
      style={{ color: "#0b0b0d", backgroundColor: isAhead ? "#4ade80" : "#f87171" }}
    >
      {gapMs > 0 ? "+" : "-"}
      {formatSwimTime(Math.abs(gapMs))}
    </span>
  );
}

/** Upcoming meets (max 2) vs their event targets -- the same readiness math
 * the coach already reasons about (lib/swim/readiness.ts), just never shown
 * anywhere in the UI before. Omitted entirely (no empty shell) if there's no
 * meet on the calendar. */
export function SwimMeetReadinessCard({ meets, today }: { meets: MeetReadinessMeet[]; today: string }) {
  const upcoming = meets.filter((m) => m.date >= today).slice(0, 2);
  if (upcoming.length === 0) return null;

  return (
    <BentoCard label="Meet readiness" colSpan={12}>
      <div className="flex flex-col gap-4">
        {upcoming.map((meet) => {
          const hasAnyTime = meet.events.some((ev) => ev.readiness.currentBestMs !== null || ev.readiness.practiceBestMs !== null);
          return (
            <div key={meet.id} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-subhead font-semibold text-[var(--rtd-text)] truncate">{meet.name}</span>
                <span className="shrink-0 text-caption font-semibold px-2 py-0.5 rounded-full bg-white/[0.08] text-[var(--rtd-text-secondary)] rtd-nums">
                  {daysOut(today, meet.date)}d out
                </span>
              </div>
              {!hasAnyTime ? (
                <Link
                  href="/swim?view=meets#log-time"
                  className="text-caption text-[var(--rtd-cyan)] cursor-pointer hover:brightness-110"
                >
                  Log your first times to project readiness →
                </Link>
              ) : (
                <div className="flex flex-col rtd-divide-y">
                  {meet.events.map((ev) => {
                    const currentBestMs = ev.readiness.currentBestMs;
                    const practiceBestMs = ev.readiness.practiceBestMs;
                    const practiceTrend = ev.readiness.practiceTrendMsPerWeek;
                    const gapMs = currentBestMs !== null ? currentBestMs - ev.targetTimeMs : null;
                    return (
                      <div key={ev.id} className="flex flex-col gap-0.5 py-1.5 first:pt-0 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className="text-subhead text-[var(--rtd-text)] flex-1 truncate">{ev.event}</span>
                          <span className="text-footnote rtd-nums text-[var(--rtd-text-secondary)]">
                            {currentBestMs !== null ? formatSwimTime(currentBestMs) : "—"}
                          </span>
                          <span className="text-caption text-[var(--rtd-text-tertiary)]" aria-hidden="true">
                            →
                          </span>
                          <span className="text-footnote rtd-nums text-[var(--rtd-text-secondary)]">{formatSwimTime(ev.targetTimeMs)}</span>
                          <GapChip gapMs={gapMs} />
                        </div>
                        {practiceBestMs !== null && (
                          <span className="text-caption text-[var(--rtd-text-tertiary)] rtd-nums">
                            practice: {formatSwimTime(practiceBestMs)}
                            {practiceTrend !== null && ` · trending ${formatTrend(practiceTrend)}`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </BentoCard>
  );
}
