/**
 * The bottleneck engine: turns everything else this app already computes
 * (DPS decay, split pacing, dive times, zone history, critical speed, the IM
 * split model, breast-kick volume) into a small ranked list of "here's what's
 * actually costing you time" findings. Every detector is confidence-gated by
 * how much data backs it -- never "high" off a single data point -- and
 * fires nothing when its inputs are missing rather than guessing.
 */

import type { DpsAnalysis } from "./dps";
import type { ZoneDistance } from "./zones";
import type { CriticalSpeed } from "./criticalSpeed";
import type { ImSplitModel, ImLeg } from "./imModel";
import { RACE_PLANS } from "./racePlans";
import { evidenceLabel } from "./evidence";

export type Bottleneck = {
  key: string;
  title: string;
  evidence: string;
  mechanism: string;
  whatToDo: string;
  confidence: "high" | "medium" | "low";
  dataUsed: string;
};

const LEG_TRAINS: Record<ImLeg, string> = {
  fly: "fly-specific race-pace 50s and upper-body force reserve",
  back: "back-half back speed and turn-into-breast transitions",
  breast: "breaststroke pace work -- the same SP1 sets that drive the standalone breast events",
  free: "closing-speed free work under fatigue, since this leg always comes last",
};

function sampleConfidence(n: number, thresholds: { high: number; medium: number }): "high" | "medium" | "low" {
  if (n >= thresholds.high) return "high";
  if (n >= thresholds.medium) return "medium";
  return "low";
}

export function detectBottlenecks(input: {
  dps: DpsAnalysis | null;
  splitAutopsy: { date: string; event: string; splits: number[]; strokeCounts: number[]; isRace: boolean }[];
  timeTo15m: { date: string; seconds: number; condition: string }[];
  zoneHistory: { weekStart: string; zoneDistance: ZoneDistance; totalM: number }[];
  criticalSpeed: CriticalSpeed | null;
  imModel: ImSplitModel | null;
  breastKickWeeklyM: { weekStart: string; m: number }[];
  daysToNextMeet: number | null;
}): Bottleneck[] {
  const out: (Bottleneck & { impact: number })[] = [];

  // 1. Length collapse
  if (input.dps && (input.dps.signature === "length-collapse" || input.dps.signature === "both")) {
    const pct = input.dps.dpsDecayPct !== null ? Math.abs(input.dps.dpsDecayPct) : 0;
    out.push({
      key: "length-collapse",
      title: "Stroke length collapses late in the race",
      evidence: `Distance-per-stroke fell ${pct.toFixed(0)}% from the first length to the last while stroke rate held steady.`,
      mechanism: `Clean speed over a 100 BR falls through loss of stroke length, not stroke rate. ${evidenceLabel("E2")}`,
      whatToDo: "Build force reserve and back-half length: hollow-body holds and jumps right after main sets, plus race-pace reps that specifically rehearse the last 50.",
      confidence: input.dps.lengths.length >= 4 ? "medium" : "low",
      dataUsed: "Most recent race's per-length splits and stroke counts",
      impact: pct,
    });
  }

  // 2. Overspent first 50
  const latestRaceWithSplits = input.splitAutopsy.find((s) => s.isRace && s.splits.length >= 2);
  const plan = latestRaceWithSplits ? RACE_PLANS.find((p) => p.event === latestRaceWithSplits.event && p.targetSplits) : undefined;
  if (latestRaceWithSplits && plan?.targetSplits) {
    const targets = plan.targetSplits;
    const firstDelta = latestRaceWithSplits.splits[0] - targets[0]; // negative = faster than target
    const lastDelta = latestRaceWithSplits.splits[latestRaceWithSplits.splits.length - 1] - targets[targets.length - 1]; // positive = slower
    if (firstDelta < -0.8 && lastDelta > 1.5) {
      out.push({
        key: "overspent-first-50",
        title: "First 50 overspent, last 50 pays for it",
        evidence: `First 50 was ${Math.abs(firstDelta).toFixed(1)}s under the target split; the last 50 came back ${lastDelta.toFixed(1)}s over.`,
        mechanism: "This is a pacing pattern, not a fitness ceiling -- the fast start borrows time the back half can't repay.",
        whatToDo: `Hold the target first-50 split (${plan.targetLabel || "the race plan"}) and bank the reserve for the last 50 instead.`,
        confidence: "medium",
        dataUsed: `${latestRaceWithSplits.event} race splits vs. the race plan target`,
        impact: lastDelta,
      });
    }
  }

  // 3. Underwater / breakout fade
  const fresh = input.timeTo15m.filter((t) => t.condition === "fresh").map((t) => t.seconds);
  const fatigued = input.timeTo15m.filter((t) => t.condition === "fatigued").map((t) => t.seconds);
  if (fresh.length > 0 && fatigued.length > 0) {
    const avgFresh = fresh.reduce((a, b) => a + b, 0) / fresh.length;
    const avgFatigued = fatigued.reduce((a, b) => a + b, 0) / fatigued.length;
    const diff = avgFatigued - avgFresh;
    if (diff > 0.25) {
      out.push({
        key: "underwater-breakout-fade",
        title: "Underwater/breakout fades under fatigue",
        evidence: `Time to 15m averages ${diff.toFixed(2)}s slower fatigued (${avgFatigued.toFixed(2)}s) than fresh (${avgFresh.toFixed(2)}s).`,
        mechanism: "Trunk stiffness and leg drive fade under lactate, so you float up instead of holding the streamline.",
        whatToDo: '"Lactic core" finishers -- hollow holds and jumps right after main lifts, so leg drive and trunk stiffness are trained fatigued, not just fresh.',
        confidence: sampleConfidence(Math.min(fresh.length, fatigued.length), { high: 3, medium: 1 }),
        dataUsed: `${fresh.length} fresh + ${fatigued.length} fatigued time-to-15m logs`,
        impact: diff,
      });
    }
  }

  // 4. Aerobic under-support for the 400 IM
  // Gated on weeks that actually HAVE a zone breakdown, not just nonzero
  // total volume -- a week logged before zone-tagging (or via the legacy
  // path) has totalM > 0 but zoneDistance === {}, which is missing data,
  // not "0% aerobic". Treating that as a real share would fabricate a
  // finding from an absence of data.
  const last4Zone = input.zoneHistory.slice(-4);
  const zoneWeeksWithData = last4Zone.filter((w) => Object.keys(w.zoneDistance).length > 0);
  if (zoneWeeksWithData.length > 0) {
    const totalM = zoneWeeksWithData.reduce((s, w) => s + w.totalM, 0);
    const aerobicM = zoneWeeksWithData.reduce((s, w) => s + (w.zoneDistance.EN1 ?? 0) + (w.zoneDistance.EN2 ?? 0), 0);
    const sharePct = totalM > 0 ? (aerobicM / totalM) * 100 : 0;
    if (totalM > 0 && sharePct < 45) {
      out.push({
        key: "aerobic-under-support-400im",
        title: "Aerobic volume is light for the 400 IM",
        evidence: `EN1+EN2 was ${sharePct.toFixed(0)}% of zone-tagged swim volume over the last 4 weeks (target: 45%+).`,
        mechanism: `A maximal effort of this duration is roughly 75-85% aerobically supplied. ${evidenceLabel("E13")}`,
        whatToDo: "Add EN1/EN2 volume, not more sprint work -- the 400 IM is limited by the aerobic base underneath it, not top speed.",
        confidence: sampleConfidence(zoneWeeksWithData.length, { high: 4, medium: 2 }),
        dataUsed: `${zoneWeeksWithData.length}/4 weeks of zone-tagged swim volume`,
        impact: 45 - sharePct,
      });
    }
  }

  // 5. Race-pace deficit
  if (input.daysToNextMeet !== null && input.daysToNextMeet <= 56 && input.daysToNextMeet >= 0) {
    const last4 = input.zoneHistory.slice(-4);
    const weeksWithData = last4.filter((w) => Object.keys(w.zoneDistance).length > 0);
    const sp1M = weeksWithData.reduce((s, w) => s + (w.zoneDistance.SP1 ?? 0), 0);
    if (weeksWithData.length > 0 && sp1M < 400) {
      out.push({
        key: "race-pace-deficit",
        title: "Not enough race-pace rehearsal this close to the meet",
        evidence: `Only ${Math.round(sp1M)}m of SP1 (race-pace) work over the last 4 weeks, with a meet ${input.daysToNextMeet}d out.`,
        mechanism: "Fitness without race-velocity rehearsal doesn't automatically transfer -- the body needs reps at the actual pace it will race.",
        whatToDo: "Add SP1 sets: race-pace 25-75m reps with generous rest, rehearsing goal splits directly.",
        confidence: sampleConfidence(weeksWithData.length, { high: 4, medium: 2 }),
        dataUsed: `${weeksWithData.length}/4 weeks of zone-tagged swim volume, ${input.daysToNextMeet}d to next meet`,
        impact: 400 - sp1M,
      });
    }
  }

  // 6. Breaststroke-kick load spike
  if (input.breastKickWeeklyM.length >= 2) {
    const thisWeek = input.breastKickWeeklyM[input.breastKickWeeklyM.length - 1];
    const priorWeeks = input.breastKickWeeklyM.slice(-5, -1);
    const priorWithData = priorWeeks.filter((w) => w.m > 0);
    const mean = priorWithData.length > 0 ? priorWithData.reduce((s, w) => s + w.m, 0) / priorWithData.length : 0;
    if (mean > 0 && thisWeek.m > mean * 1.5) {
      out.push({
        key: "breast-kick-load-spike",
        title: "Breaststroke-kick volume spiked this week",
        evidence: `${Math.round(thisWeek.m)}m of breast kick this week vs. a ${Math.round(mean)}m 4-week mean (${(thisWeek.m / mean).toFixed(1)}x).`,
        mechanism: `Breaststroker's knee affects 73-86% of specialists, and risk tracks kick volume and exposure. ${evidenceLabel("E4")}`,
        whatToDo: "Redistribute kick volume across the week rather than stopping it outright -- spread the same total load over more sessions.",
        confidence: sampleConfidence(priorWithData.length, { high: 4, medium: 2 }),
        dataUsed: `${priorWithData.length}/4 prior weeks of breast-kick metres`,
        impact: thisWeek.m / mean,
      });
    }
  }

  // 7. IM leg weakness
  if (input.imModel) {
    const withDelta = input.imModel.legs.filter((l): l is (typeof input.imModel.legs)[number] & { deltaSec: number } => l.deltaSec !== null);
    const weakest = withDelta.filter((l) => l.deltaSec > 0).sort((a, b) => b.deltaSec - a.deltaSec)[0];
    if (weakest) {
      out.push({
        key: "im-leg-weakness",
        title: `${weakest.leg[0].toUpperCase()}${weakest.leg.slice(1)} leg is the ${input.imModel.event} weak point`,
        evidence: `${weakest.deltaSec > 0 ? "+" : ""}${weakest.deltaSec.toFixed(1)}s vs. the standard elite split shape on the ${weakest.leg} leg — the largest gap of the four.`,
        mechanism: "The IM split shape is a coaching-convention target, not a measured threshold, but a single leg running furthest behind it is where the next block's work should go.",
        whatToDo: `Prioritize ${LEG_TRAINS[weakest.leg]}.`,
        confidence: "medium",
        dataUsed: `Most recent ${input.imModel.event} race splits vs. the standard IM split shape`,
        impact: weakest.deltaSec,
      });
    }
  }

  const confidenceRank: Record<Bottleneck["confidence"], number> = { high: 2, medium: 1, low: 0 };
  return out
    .sort((a, b) => confidenceRank[b.confidence] - confidenceRank[a.confidence] || b.impact - a.impact)
    .map((b) => ({
      key: b.key,
      title: b.title,
      evidence: b.evidence,
      mechanism: b.mechanism,
      whatToDo: b.whatToDo,
      confidence: b.confidence,
      dataUsed: b.dataUsed,
    }));
}
