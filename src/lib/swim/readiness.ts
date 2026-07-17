/**
 * Meet-readiness projection: a simple least-squares linear trend fit through
 * logged times for an event, projected forward to the meet date. This is
 * intentionally a plain regression, not a real predictive model (no paid
 * LLM/ML calls per the build constraint) -- confidence is a heuristic on
 * sample size + fit quality, not a calibrated probability. Training load and
 * gym progression are surfaced as separate supporting context rather than
 * blended into the projection itself, since there's no principled way to
 * weight three different signals without real outcome data to calibrate
 * against -- see DECISIONS.md.
 */

export type TimePoint = { date: string; timeMs: number };

export type ReadinessResult = {
  currentBestMs: number | null;
  projectedMs: number | null;
  gapToTargetMs: number | null; // projectedMs - targetTimeMs; positive = still slower than target
  trendMsPerWeek: number | null; // negative = getting faster
  confidence: "low" | "medium" | "high" | "none";
  pointsUsed: number;
};

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return (to - from) / 86_400_000;
}

export function computeMeetReadiness(params: {
  targetTimeMs: number;
  loggedTimes: TimePoint[]; // any order
  meetDate: string;
  today: string;
}): ReadinessResult {
  const { targetTimeMs, meetDate, today } = params;
  const points = [...params.loggedTimes].sort((a, b) => (a.date < b.date ? -1 : 1));

  if (points.length === 0) {
    return { currentBestMs: null, projectedMs: null, gapToTargetMs: null, trendMsPerWeek: null, confidence: "none", pointsUsed: 0 };
  }

  const currentBestMs = Math.min(...points.map((p) => p.timeMs));

  if (points.length === 1) {
    const only = points[0];
    return {
      currentBestMs,
      projectedMs: only.timeMs,
      gapToTargetMs: only.timeMs - targetTimeMs,
      trendMsPerWeek: null,
      confidence: "low",
      pointsUsed: 1,
    };
  }

  const firstDate = points[0].date;
  const xs = points.map((p) => daysBetweenISO(firstDate, p.date));
  const ys = points.map((p) => p.timeMs);
  const n = points.length;
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
    projectedMs,
    gapToTargetMs: projectedMs - targetTimeMs,
    trendMsPerWeek: Math.round(slope * 7),
    confidence,
    pointsUsed: n,
  };
}
