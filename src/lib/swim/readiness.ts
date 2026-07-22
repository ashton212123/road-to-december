/**
 * Meet-readiness projection: a simple least-squares linear trend fit through
 * logged RACE times for an event, projected forward to the meet date. This
 * is intentionally a plain regression, not a real predictive model (no paid
 * LLM/ML calls per the build constraint) -- confidence is a heuristic on
 * sample size + fit quality, not a calibrated probability.
 *
 * Race vs. practice separation (2026-07-21): practice swims and tapered/
 * rested race swims are different regimes -- there is no universal formula
 * that converts one into the other, so they are never blended. Only race
 * results (isPb, or logged under a meet name) drive currentBestMs and the
 * projection. Practice times surface as a separate, clearly-labeled training
 * signal (practiceBestMs / practiceTrendMsPerWeek) and never feed the
 * meet-readiness math.
 */

export type TimePoint = { date: string; timeMs: number; isRace: boolean };

export type ReadinessResult = {
  currentBestMs: number | null; // best RACE result only
  practiceBestMs: number | null; // best practice result -- training signal, never a race prediction
  projectedMs: number | null; // from race results only
  gapToTargetMs: number | null; // projectedMs - targetTimeMs; positive = still slower than target
  trendMsPerWeek: number | null; // race trend; negative = getting faster
  practiceTrendMsPerWeek: number | null; // practice trend; negative = getting faster in practice
  confidence: "low" | "medium" | "high" | "none";
  pointsUsed: number; // race points used in the projection
};

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return (to - from) / 86_400_000;
}

function linearRegression(points: { date: string; timeMs: number }[]) {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  const firstDate = sorted[0].date;
  const xs = sorted.map((p) => daysBetweenISO(firstDate, p.date));
  const ys = sorted.map((p) => p.timeMs);
  const n = sorted.length;
  const meanX = xs.reduce((s, x) => s + x, 0) / n;
  const meanY = ys.reduce((s, y) => s + y, 0) / n;

  let ssXY = 0;
  let ssXX = 0;
  for (let i = 0; i < n; i++) {
    ssXY += (xs[i] - meanX) * (ys[i] - meanY);
    ssXX += (xs[i] - meanX) ** 2;
  }
  const slope = ssXX === 0 ? 0 : ssXY / ssXX; // ms per day
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * xs[i];
    ssRes += (ys[i] - predicted) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, r2, firstDate };
}

export function computeMeetReadiness(params: {
  targetTimeMs: number;
  loggedTimes: TimePoint[]; // any order, mixed race + practice
  meetDate: string;
  today: string;
}): ReadinessResult {
  const { targetTimeMs, meetDate, today, loggedTimes } = params;
  const raceTimes = loggedTimes.filter((p) => p.isRace);
  const practiceTimes = loggedTimes.filter((p) => !p.isRace);

  const practiceBestMs = practiceTimes.length > 0 ? Math.min(...practiceTimes.map((p) => p.timeMs)) : null;
  const practiceTrendMsPerWeek = practiceTimes.length >= 3 ? Math.round(linearRegression(practiceTimes).slope * 7) : null;

  if (raceTimes.length === 0) {
    return {
      currentBestMs: null,
      practiceBestMs,
      projectedMs: null,
      gapToTargetMs: null,
      trendMsPerWeek: null,
      practiceTrendMsPerWeek,
      confidence: "none",
      pointsUsed: 0,
    };
  }

  const currentBestMs = Math.min(...raceTimes.map((p) => p.timeMs));

  if (raceTimes.length === 1) {
    const only = raceTimes[0];
    return {
      currentBestMs,
      practiceBestMs,
      projectedMs: only.timeMs,
      gapToTargetMs: only.timeMs - targetTimeMs,
      trendMsPerWeek: null,
      practiceTrendMsPerWeek,
      confidence: "low",
      pointsUsed: 1,
    };
  }

  const { slope, intercept, r2, firstDate } = linearRegression(raceTimes);
  const n = raceTimes.length;

  const meetOffsetDays = daysBetweenISO(firstDate, meetDate);
  const todayOffsetDays = daysBetweenISO(firstDate, today);
  // Never project further back than today's actual trend position, and never
  // project a meet that's already passed as if it were in the future.
  const projectionX = Math.max(meetOffsetDays, todayOffsetDays);
  const projectedMs = Math.round(intercept + slope * projectionX);

  let confidence: ReadinessResult["confidence"];
  if (n < 3) confidence = "low";
  else if (n >= 5 && r2 >= 0.5) confidence = "high";
  else if (r2 >= 0.25) confidence = "medium";
  else confidence = "low";

  return {
    currentBestMs,
    practiceBestMs,
    projectedMs,
    gapToTargetMs: projectedMs - targetTimeMs,
    trendMsPerWeek: Math.round(slope * 7),
    practiceTrendMsPerWeek,
    confidence,
    pointsUsed: n,
  };
}
