import { aggregateByPeriod, aggregateByDateRange, pctChange, trailingWindows, type Period, type AggType } from "@/lib/analytics/periods";
import type { DotStatus } from "@/components/ui/DotStrip";
import { bestSetE1RM } from "@/lib/train/e1rm";

export type MatrixRow = {
  key: string;
  label: string;
  domainColor: string;
  unit: string;
  decimals: number;
  goodDirection: "up" | "down";
  sparkline: number[];
  current: number | null;
  previous: number | null;
  deltaPct: number | null;
  dots: { status: DotStatus; label: string }[];
  needsDataHint: string | null;
  /** Intraday % accumulators (kcal/protein/water) never get a period-over-
   * period delta -- comparing a partial current period to a complete prior
   * one is what produced the old "-100%" chips. These get a progress-to-
   * target chip instead, driven by progressPct (== current for rows already
   * expressed as a %; converted from a raw unit like water's liters via
   * targetForProgress otherwise). */
  isProgressMetric?: boolean;
  overIsGood?: boolean;
  progressPct: number | null;
};

function buildRow(params: {
  key: string;
  label: string;
  domainColor: string;
  unit: string;
  decimals?: number;
  goodDirection: "up" | "down";
  rows: { date: string; value: number }[];
  agg: AggType;
  period: Period;
  periodStarts: string[];
  trailing: { current: [string, string]; previous: [string, string] };
  needsDataHint: string;
  isProgressMetric?: boolean;
  overIsGood?: boolean;
  /** For progress rows whose value isn't already a %, e.g. water's liters --
   * progressPct becomes (current / targetForProgress) * 100. Omit when
   * `current` is already a percentage (kcal/protein adherence). */
  targetForProgress?: number;
}): MatrixRow {
  // Sparkline/dots stay on the calendar-aligned period history (unaffected
  // by this row's headline numbers) so the detail charts keep matching the
  // Week/Month period selector exactly as before.
  const values = aggregateByPeriod(params.rows, params.period, params.periodStarts, params.agg);

  // current/previous/delta use a trailing window ending today instead of
  // calendar-period-to-date -- a session from a few days ago still counts
  // on a Monday morning, instead of a fresh (near-empty) calendar week
  // making the row look like it needs more data.
  const current = aggregateByDateRange(params.rows, params.trailing.current[0], params.trailing.current[1], params.agg);
  const previous = aggregateByDateRange(params.rows, params.trailing.previous[0], params.trailing.previous[1], params.agg);
  const hasEnoughData = current !== null;

  const dots: { status: DotStatus; label: string }[] = [];
  for (let i = 1; i < values.length; i++) {
    const a = values[i];
    const b = values[i - 1];
    let status: DotStatus = "flat";
    if (a !== null && b !== null && a !== b) {
      const improved = params.goodDirection === "up" ? a > b : a < b;
      status = improved ? "improved" : "declined";
    }
    dots.push({ status, label: params.periodStarts[i] });
  }

  return {
    key: params.key,
    label: params.label,
    domainColor: params.domainColor,
    unit: params.unit,
    decimals: params.decimals ?? 1,
    goodDirection: params.goodDirection,
    sparkline: values.filter((v): v is number => v !== null),
    current: hasEnoughData ? current : null,
    previous: hasEnoughData ? previous : null,
    deltaPct: hasEnoughData ? pctChange(current, previous) : null,
    dots,
    needsDataHint: hasEnoughData ? null : params.needsDataHint,
    isProgressMetric: params.isProgressMetric,
    overIsGood: params.overIsGood,
    progressPct: !hasEnoughData || current === null
      ? null
      : params.targetForProgress !== undefined
        ? (current / params.targetForProgress) * 100
        : current,
  };
}

export function buildImprovementMatrix(params: {
  period: Period;
  todayISO: string;
  periodStarts: string[];
  mainLiftLogs: { exerciseName: string; date: string; weightKg: string | null; reps: number | null; isMainLift: boolean; movementPattern: string | null }[];
  swimTimes: { event: string; date: string; timeMs: number }[];
  weighIns: { date: string; kg: string }[];
  cmjTests: { date: string; bestOf3Cm: string }[];
  sleepLogs: { date: string; hours: string }[];
  waterLogsDaily: { date: string; ml: number }[];
  proteinAdherenceDaily: { date: string; pct: number }[];
  kcalAdherenceDaily: { date: string; pct: number }[];
  gymSessionDates: string[];
  waterTargetMl: number;
}): MatrixRow[] {
  const { period, periodStarts } = params;
  const trailing = trailingWindows(params.todayISO, period);
  const rows: MatrixRow[] = [];

  const TONNAGE_PATTERNS = new Set(["squat", "hinge", "press", "pull"]);
  const byLiftDate = new Map<string, Map<string, { weightKg: number | null; reps: number | null }[]>>();
  const tonnageRows: { date: string; value: number }[] = [];
  for (const log of params.mainLiftLogs) {
    if (log.isMainLift) {
      if (!byLiftDate.has(log.exerciseName)) byLiftDate.set(log.exerciseName, new Map());
      const byDate = byLiftDate.get(log.exerciseName)!;
      if (!byDate.has(log.date)) byDate.set(log.date, []);
      byDate.get(log.date)!.push({ weightKg: log.weightKg ? Number(log.weightKg) : null, reps: log.reps });
    }
    if (log.movementPattern && TONNAGE_PATTERNS.has(log.movementPattern) && log.weightKg && log.reps) {
      tonnageRows.push({ date: log.date, value: Number(log.weightKg) * log.reps });
    }
  }

  for (const [lift, byDate] of byLiftDate) {
    const e1rmRows = [...byDate.entries()]
      .map(([date, sets]) => ({ date, e1rm: bestSetE1RM(sets) }))
      .filter((p): p is { date: string; e1rm: number } => p.e1rm !== null)
      .map((p) => ({ date: p.date, value: p.e1rm }));
    rows.push(
      buildRow({
        key: `strength-${lift}`,
        label: lift,
        domainColor: "var(--rtd-domain-train)",
        unit: "kg e1RM",
        goodDirection: "up",
        rows: e1rmRows,
        agg: "max",
        period,
        periodStarts,
        trailing,
        needsDataHint: `needs more data — log ${lift.toLowerCase()} sets`,
      })
    );
  }

  const bySwimEvent = new Map<string, { date: string; value: number }[]>();
  for (const t of params.swimTimes) {
    if (!bySwimEvent.has(t.event)) bySwimEvent.set(t.event, []);
    bySwimEvent.get(t.event)!.push({ date: t.date, value: t.timeMs / 1000 });
  }
  for (const [event, evRows] of bySwimEvent) {
    rows.push(
      buildRow({
        key: `swim-${event}`,
        label: event,
        domainColor: "var(--rtd-domain-swim)",
        unit: "s",
        decimals: 2,
        goodDirection: "down",
        rows: evRows,
        agg: "min",
        period,
        periodStarts,
        trailing,
        needsDataHint: `needs more data — log a ${event} time`,
      })
    );
  }

  rows.push(
    buildRow({
      key: "bodyweight",
      label: "Bodyweight",
      domainColor: "var(--rtd-cyan)",
      unit: "kg",
      goodDirection: "up",
      rows: params.weighIns.map((w) => ({ date: w.date, value: Number(w.kg) })),
      agg: "avg",
      period,
      periodStarts,
      trailing,
      needsDataHint: "needs more data — log a weigh-in",
    })
  );

  rows.push(
    buildRow({
      key: "tonnage",
      label: "Weekly tonnage",
      domainColor: "var(--rtd-domain-train)",
      unit: "kg",
      decimals: 0,
      goodDirection: "up",
      rows: tonnageRows,
      agg: "sum",
      period,
      periodStarts,
      trailing,
      needsDataHint: "needs more data — log gym sets",
    })
  );

  rows.push(
    buildRow({
      key: "gym-sessions",
      label: "Gym sessions logged",
      domainColor: "var(--rtd-domain-train)",
      unit: "",
      decimals: 0,
      goodDirection: "up",
      rows: params.gymSessionDates.map((date) => ({ date, value: 1 })),
      agg: "sum",
      period,
      periodStarts,
      trailing,
      needsDataHint: "needs more data — log a gym session",
    })
  );

  rows.push(
    buildRow({
      key: "protein-adherence",
      label: "Protein adherence",
      domainColor: "var(--rtd-green)",
      unit: "%",
      decimals: 0,
      goodDirection: "up",
      rows: params.proteinAdherenceDaily.map((d) => ({ date: d.date, value: d.pct })),
      agg: "avg",
      period,
      periodStarts,
      trailing,
      needsDataHint: "needs more data — log meals",
      isProgressMetric: true,
    })
  );

  rows.push(
    buildRow({
      key: "kcal-adherence",
      label: "Kcal adherence",
      domainColor: "var(--rtd-domain-fuel)",
      unit: "%",
      decimals: 0,
      goodDirection: "up",
      rows: params.kcalAdherenceDaily.map((d) => ({ date: d.date, value: d.pct })),
      agg: "avg",
      period,
      periodStarts,
      trailing,
      needsDataHint: "needs more data — log meals",
      isProgressMetric: true,
    })
  );

  rows.push(
    buildRow({
      key: "sleep",
      label: "Sleep avg",
      domainColor: "var(--rtd-purple)",
      unit: "h",
      goodDirection: "up",
      rows: params.sleepLogs.map((s) => ({ date: s.date, value: Number(s.hours) })),
      agg: "avg",
      period,
      periodStarts,
      trailing,
      needsDataHint: "needs more data — log sleep",
    })
  );

  rows.push(
    buildRow({
      key: "water",
      label: "Water avg",
      domainColor: "var(--rtd-cyan)",
      unit: "L",
      goodDirection: "up",
      rows: params.waterLogsDaily.map((w) => ({ date: w.date, value: w.ml / 1000 })),
      agg: "avg",
      period,
      periodStarts,
      trailing,
      needsDataHint: "needs more data — log water",
      isProgressMetric: true,
      overIsGood: true,
      targetForProgress: params.waterTargetMl / 1000,
    })
  );

  rows.push(
    buildRow({
      key: "cmj",
      label: "CMJ",
      domainColor: "var(--rtd-green)",
      unit: "cm",
      goodDirection: "up",
      rows: params.cmjTests.map((c) => ({ date: c.date, value: Number(c.bestOf3Cm) })),
      agg: "max",
      period,
      periodStarts,
      trailing,
      needsDataHint: "needs more data — log a CMJ test",
    })
  );

  return rows;
}
