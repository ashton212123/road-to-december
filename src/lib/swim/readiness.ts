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
 *
 * Course separation (2026-07-26): SCM and LCM race times are also never
 * blended into one trend -- see course.ts. The regression only ever runs
 * over race results in the target meet's own course. When there aren't
 * enough same-course race points, `convertedSupport` names how many
 * other-course races exist and that a [coaching convention] estimate could
 * bridge them, but it never becomes a silent numeric projection itself.
 */

import { isConvertible, type Course } from "./course";

export type TimePoint = { date: string; timeMs: number; isRace: boolean; course: Course | null };

export type ReadinessResult = {
  currentBestMs: number | null; // best RACE result in the target course only
  practiceBestMs: number | null; // best practice result -- training signal, never a race prediction
  projectedMs: number | null; // from same-course race results only
  gapToTargetMs: number | null; // projectedMs - targetTimeMs; positive = still slower than target
  trendMsPerWeek: number | null; // race trend; negative = getting faster
  practiceTrendMsPerWeek: number | null; // practice trend; negative = getting faster in practice
  confidence: "low" | "medium" | "high" | "none";
  pointsUsed: number; // same-course race points used in the projection
  convertedSupport: { fromCourse: Course; count: number; note: string } | null;
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
  event: string;
  targetTimeMs: number;
  loggedTimes: TimePoint[]; // any order, mixed race + practice, mixed course
  meetDate: string;
  today: string;
  targetCourse: Course;
}): ReadinessResult {
  const { event, targetTimeMs, meetDate, today, loggedTimes, targetCourse } = params;
  const raceTimes = loggedTimes.filter((p) => p.isRace);
  const practiceTimes = loggedTimes.filter((p) => !p.isRace);

  const practiceBestMs = practiceTimes.length > 0 ? Math.min(...practiceTimes.map((p) => p.timeMs)) : null;
  const practiceTrendMsPerWeek = practiceTimes.length >= 3 ? Math.round(linearRegression(practiceTimes).slope * 7) : null;

  const sameCourseRace = raceTimes.filter((p) => p.course === targetCourse);
  const otherCourse: Course = targetCourse === "SCM" ? "LCM" : "SCM";
  const otherCourseRaceCount = raceTimes.filter((p) => p.course === otherCourse).length;

  let convertedSupport: ReadinessResult["convertedSupport"] = null;
  if (sameCourseRace.length < 2 && otherCourseRaceCount >= 2 && isConvertible(event)) {
    convertedSupport = {
      fromCourse: otherCourse,
      count: otherCourseRaceCount,
      note: `Only ${sameCourseRace.length} ${targetCourse} race${sameCourseRace.length === 1 ? "" : "s"} on record. This projection uses ${otherCourseRaceCount} ${otherCourse} times converted with a standard estimate [coaching convention] — treat it as indicative, not a prediction.`,
    };
  }

  if (sameCourseRace.length === 0) {
    return {
      currentBestMs: null,
      practiceBestMs,
      projectedMs: null,
      gapToTargetMs: null,
      trendMsPerWeek: null,
      practiceTrendMsPerWeek,
      confidence: "none",
      pointsUsed: 0,
      convertedSupport,
    };
  }

  const currentBestMs = Math.min(...sameCourseRace.map((p) => p.timeMs));

  if (sameCourseRace.length === 1) {
    const only = sameCourseRace[0];
    // A converted-support note is a deliberately separate, softer signal --
    // when it fires, the single same-course point doesn't also masquerade as
    // "the" projection (spec: "the primary projectedMs stays null in that case").
    return convertedSupport
      ? {
          currentBestMs,
          practiceBestMs,
          projectedMs: null,
          gapToTargetMs: null,
          trendMsPerWeek: null,
          practiceTrendMsPerWeek,
          confidence: "low",
          pointsUsed: 1,
          convertedSupport,
        }
      : {
          currentBestMs,
          practiceBestMs,
          projectedMs: only.timeMs,
          gapToTargetMs: only.timeMs - targetTimeMs,
          trendMsPerWeek: null,
          practiceTrendMsPerWeek,
          confidence: "low",
          pointsUsed: 1,
          convertedSupport: null,
        };
  }

  const { slope, intercept, r2, firstDate } = linearRegression(sameCourseRace);
  const n = sameCourseRace.length;

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
    convertedSupport: null,
  };
}
