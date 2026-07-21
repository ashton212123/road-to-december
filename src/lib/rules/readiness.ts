export type ReadinessLight = "green" | "yellow" | "red";

export type ReadinessSignal = {
  label: string;
  light: ReadinessLight;
  detail: string;
};

/**
 * Transparent inputs, no invented composite score (per spec): last night's
 * sleep vs the 8-9h target, this week's CMJ trend, the acute:chronic load
 * ratio, and (when there's a recent log to reason about) soreness. Each
 * gets its own traffic light -- soreness isn't logged daily, so unlike the
 * other three it's omitted entirely rather than shown as an unknown-yellow
 * when there's nothing recent to go on.
 */
export function computeReadinessSignals(input: {
  lastSleepHours: number | null;
  cmjTrend: "up" | "flat" | "down" | "insufficient-data";
  acwrRatio: number | null;
  recentSoreness?: { rating: number; area: string; date: string } | null;
}): ReadinessSignal[] {
  const signals: ReadinessSignal[] = [];

  if (input.lastSleepHours === null) {
    signals.push({ label: "Sleep", light: "yellow", detail: "No sleep logged last night." });
  } else if (input.lastSleepHours >= 8) {
    signals.push({ label: "Sleep", light: "green", detail: `${input.lastSleepHours}h — at or above the 8–9h target.` });
  } else if (input.lastSleepHours >= 6.5) {
    signals.push({ label: "Sleep", light: "yellow", detail: `${input.lastSleepHours}h — below the 8–9h target.` });
  } else {
    signals.push({ label: "Sleep", light: "red", detail: `${input.lastSleepHours}h — well under target.` });
  }

  if (input.cmjTrend === "up") {
    signals.push({ label: "CMJ trend", light: "green", detail: "Trending up week over week." });
  } else if (input.cmjTrend === "flat") {
    signals.push({ label: "CMJ trend", light: "yellow", detail: "Flat vs last week." });
  } else if (input.cmjTrend === "down") {
    signals.push({ label: "CMJ trend", light: "red", detail: "Down vs last week — watch for a 2nd straight decline." });
  } else {
    signals.push({ label: "CMJ trend", light: "yellow", detail: "Not enough CMJ history yet." });
  }

  if (input.acwrRatio === null) {
    signals.push({ label: "Acute:chronic ratio", light: "yellow", detail: "Not enough training history yet." });
  } else if (input.acwrRatio <= 1.3) {
    signals.push({ label: "Acute:chronic ratio", light: "green", detail: `${input.acwrRatio.toFixed(2)} — sustainable.` });
  } else if (input.acwrRatio <= 1.5) {
    signals.push({ label: "Acute:chronic ratio", light: "yellow", detail: `${input.acwrRatio.toFixed(2)} — watch this week.` });
  } else {
    signals.push({ label: "Acute:chronic ratio", light: "red", detail: `${input.acwrRatio.toFixed(2)} — above 1.5, trim volume.` });
  }

  if (input.recentSoreness) {
    const { rating, area, date } = input.recentSoreness;
    signals.push({
      label: "Soreness",
      light: rating >= 4 ? "red" : rating === 3 ? "yellow" : "green",
      detail: rating >= 4 ? `${area} soreness ${rating}/5 — logged ${date}.` : `Mild — ${area} ${rating}/5, logged ${date}.`,
    });
  }

  return signals;
}
