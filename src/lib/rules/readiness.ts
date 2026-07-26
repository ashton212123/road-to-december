export type ReadinessLight = "green" | "yellow" | "red";

export type ReadinessSignal = {
  label: string;
  light: ReadinessLight;
  detail: string;
};

/**
 * Transparent inputs, no invented composite score (per spec). Loop 37
 * rebuild (G5): ACWR is OUT (statistical problems, no causal injury link --
 * see computeAcwr's doc comment) and replaced by a descriptive weekly load
 * ramp; CMJ compares against a 4-week baseline instead of one-sample "vs
 * last test" noise; breast-kick ramp is added as the one injury-specific
 * signal the evidence actually supports for him (E4). Soreness isn't logged
 * daily, so unlike the other four it's omitted entirely rather than shown
 * as an unknown-yellow when there's nothing recent to go on.
 */
export function computeReadinessSignals(input: {
  lastSleepHours: number | null;
  cmjLatestCm: number | null;
  cmjBaselineCm: number | null; // mean of tests in the 4wk window before the latest, excluding it
  weeklyLoadRampPct: number | null; // this week's total load vs last week's, from computeWeekOverWeekRamp
  breastKickRatio: number | null; // this week's breast-kick metres / prior-4-week mean
  recentSoreness?: { rating: number; area: string; date: string } | null;
}): ReadinessSignal[] {
  const signals: ReadinessSignal[] = [];

  if (input.lastSleepHours === null) {
    signals.push({ label: "Sleep", light: "yellow", detail: "No sleep logged last night." });
  } else if (input.lastSleepHours >= 8) {
    signals.push({ label: "Sleep", light: "green", detail: `${input.lastSleepHours}h — at or above the 8–9h target. [strong]` });
  } else if (input.lastSleepHours >= 6.5) {
    signals.push({ label: "Sleep", light: "yellow", detail: `${input.lastSleepHours}h — below the 8–9h target. [strong]` });
  } else {
    signals.push({ label: "Sleep", light: "red", detail: `${input.lastSleepHours}h — well under target. [strong]` });
  }

  if (input.cmjLatestCm === null || input.cmjBaselineCm === null || input.cmjBaselineCm === 0) {
    signals.push({ label: "CMJ vs baseline", light: "yellow", detail: "Not enough CMJ history yet for a 4-week baseline." });
  } else {
    const pct = ((input.cmjLatestCm - input.cmjBaselineCm) / input.cmjBaselineCm) * 100;
    if (pct >= -2) {
      signals.push({ label: "CMJ vs baseline", light: "green", detail: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% vs your 4-week baseline. [moderate]` });
    } else if (pct >= -5) {
      signals.push({ label: "CMJ vs baseline", light: "yellow", detail: `${pct.toFixed(1)}% vs your 4-week baseline — mild neuromuscular fatigue. [moderate]` });
    } else {
      signals.push({ label: "CMJ vs baseline", light: "red", detail: `${pct.toFixed(1)}% vs your 4-week baseline — meaningful drop. [moderate]` });
    }
  }

  if (input.recentSoreness) {
    const { rating, area, date } = input.recentSoreness;
    signals.push({
      label: "Soreness",
      light: rating >= 4 ? "red" : rating === 3 ? "yellow" : "green",
      detail: rating >= 4 ? `${area} soreness ${rating}/5 — logged ${date}. [coaching convention]` : `Mild — ${area} ${rating}/5, logged ${date}. [coaching convention]`,
    });
  }

  if (input.weeklyLoadRampPct === null) {
    signals.push({ label: "Weekly load ramp", light: "yellow", detail: "Building baseline — needs at least 2 weeks of logged sessions." });
  } else if (input.weeklyLoadRampPct <= 15) {
    signals.push({
      label: "Weekly load ramp",
      light: "green",
      detail: `${input.weeklyLoadRampPct > 0 ? "+" : ""}${input.weeklyLoadRampPct.toFixed(0)}% vs last week — descriptive only, not a risk score. [coaching convention]`,
    });
  } else if (input.weeklyLoadRampPct <= 30) {
    signals.push({
      label: "Weekly load ramp",
      light: "yellow",
      detail: `+${input.weeklyLoadRampPct.toFixed(0)}% vs last week — a fast ramp. [coaching convention]`,
    });
  } else {
    signals.push({
      label: "Weekly load ramp",
      light: "red",
      detail: `+${input.weeklyLoadRampPct.toFixed(0)}% vs last week — a very fast ramp. [coaching convention]`,
    });
  }

  if (input.breastKickRatio === null) {
    signals.push({ label: "Breast-kick ramp", light: "yellow", detail: "Not enough breast-kick history yet for a 4-week baseline." });
  } else if (input.breastKickRatio < 1.3) {
    signals.push({ label: "Breast-kick ramp", light: "green", detail: `${input.breastKickRatio.toFixed(1)}x your 4-week mean. [moderate]` });
  } else if (input.breastKickRatio <= 1.6) {
    signals.push({ label: "Breast-kick ramp", light: "yellow", detail: `${input.breastKickRatio.toFixed(1)}x your 4-week mean — breaststroker's knee tracks kick volume. [moderate]` });
  } else {
    signals.push({ label: "Breast-kick ramp", light: "red", detail: `${input.breastKickRatio.toFixed(1)}x your 4-week mean — sharp spike. [moderate]` });
  }

  return signals;
}
