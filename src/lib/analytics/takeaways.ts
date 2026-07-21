import type { AcwrPoint } from "@/lib/analytics/load";
import type { ReadinessResult } from "@/lib/swim/readiness";

/** Pure, rule-computed one-liners for the Analytics tabs where the answer is
 * just arithmetic on data already on screen -- no judgment call needed, so
 * no AI call either. Strength's takeaway (plateau diagnosis) is the one tab
 * that genuinely needs judgment and lives in coach/strengthTakeaway.ts instead. */

export function loadTakeaway(acwr: AcwrPoint[]): string | null {
  const latest = [...acwr].reverse().find((p) => p.ratio !== null);
  if (!latest || latest.ratio === null) {
    // Sessions exist (acwr is non-empty) but none are old enough for a real
    // chronic baseline yet -- explain the gap instead of showing nothing.
    if (acwr.length > 0) return "Building your load baseline — ACWR needs about two weeks of logged sessions before it means anything.";
    return null;
  }
  const r = latest.ratio;
  if (r > 1.5) return `ACWR is ${r.toFixed(2)} — acute load is spiking well above your 28-day baseline. Back off intensity this week.`;
  if (r > 1.3) return `ACWR is ${r.toFixed(2)} — trending high. Watch soreness and sleep over the next few days.`;
  if (r < 0.8) return `ACWR is ${r.toFixed(2)} — load is light relative to your recent baseline, room to push if recovery allows.`;
  return `ACWR is ${r.toFixed(2)} — acute and chronic load are well balanced.`;
}

export function powerTakeaway(
  cmjSeries: { date: string; cm: number }[],
  broadJumpSeries: { date: string; cm: number }[]
): string | null {
  const useCmj = cmjSeries.length >= broadJumpSeries.length;
  const series = useCmj ? cmjSeries : broadJumpSeries;
  const label = useCmj ? "CMJ" : "Broad jump";
  if (series.length < 2) return null;

  const first = series[0].cm;
  const last = series[series.length - 1].cm;
  const delta = last - first;
  const pct = first !== 0 ? (delta / first) * 100 : 0;
  if (Math.abs(pct) < 2) return `${label} has held steady around ${last.toFixed(1)}cm over your last ${series.length} tests.`;
  return `${label} is ${delta > 0 ? "up" : "down"} ${Math.abs(delta).toFixed(1)}cm (${pct > 0 ? "+" : ""}${pct.toFixed(0)}%) since your first test in this window.`;
}

export function bodyweightTakeaway(weightSeries: { date: string; kg: number; avg7: number }[]): string | null {
  if (weightSeries.length < 2) return null;
  const first = weightSeries[0].avg7;
  const last = weightSeries[weightSeries.length - 1].avg7;
  const delta = last - first;
  if (Math.abs(delta) < 0.3) return `Weight has held steady around ${last.toFixed(1)}kg (7-day avg) over this window.`;
  return `7-day avg weight has ${delta > 0 ? "climbed" : "dropped"} ${Math.abs(delta).toFixed(1)}kg over this window, now ${last.toFixed(1)}kg.`;
}

type MeetWithReadiness = {
  name: string;
  date: string;
  events: { event: string; readiness: ReadinessResult }[];
};

export function swimTakeaway(meets: MeetWithReadiness[], today: string): string | null {
  const upcoming = meets.filter((m) => m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const nextMeet = upcoming[0];
  if (!nextMeet) return null;

  const rankedEvents = nextMeet.events
    .filter((e) => e.readiness.confidence !== "none" && e.readiness.gapToTargetMs !== null)
    .sort((a, b) => (b.readiness.gapToTargetMs ?? 0) - (a.readiness.gapToTargetMs ?? 0));
  const worst = rankedEvents[0];
  if (!worst || worst.readiness.gapToTargetMs === null) {
    return `${nextMeet.events.length} event${nextMeet.events.length === 1 ? "" : "s"} entered for ${nextMeet.name} — log more times to get a readiness projection.`;
  }

  const gapSec = worst.readiness.gapToTargetMs / 1000;
  const trend = worst.readiness.trendMsPerWeek;
  if (gapSec <= 0) {
    return `${worst.event} is projected on or under target for ${nextMeet.name} — the biggest gap left is already closed.`;
  }
  const trendNote = trend !== null && trend < 0 ? ", and you're trending faster" : trend !== null && trend > 0 ? ", but the trend has slowed lately" : "";
  return `${worst.event} is the widest gap for ${nextMeet.name}: projected ${gapSec.toFixed(1)}s off target${trendNote}.`;
}
