import { SectionLabel } from "@/components/ui/SectionLabel";
import { AnalyticsView } from "@/components/analytics/AnalyticsView";
import { seasonData } from "@/lib/data/season-data";
import { todayManilaISO, addDaysISO } from "@/lib/time";
import {
  getWorkoutLogsWithExerciseSince,
  getWeighIns,
  getCmjTests,
  getJumpTests,
  getSwimTimes,
  getTimeTo15mLogs,
} from "@/lib/db/queries";
import { bestSetE1RM } from "@/lib/train/e1rm";
import { computeDailySessionLoads, computeAcwr } from "@/lib/analytics/load";
import { computeWeeklyTonnage, computeWeeklyHardSets } from "@/lib/analytics/tonnage";

const MAIN_LIFT_TARGETS: Record<string, { label: string; goalKg: number }> = {
  "Back squat": { label: "Back squat", goalKg: 100 },
  "Trap-bar deadlift": { label: "Trap-bar deadlift", goalKg: 130 },
};

export default async function AnalyticsPage() {
  const today = todayManilaISO();
  const since = addDaysISO(today, -180);

  const [mainLiftLogs, weighIns, cmjTests, broadJumps, swimTimes, timeTo15m] = await Promise.all([
    getWorkoutLogsWithExerciseSince(since),
    getWeighIns(180),
    getCmjTests(30),
    getJumpTests("broad_jump", 30),
    getSwimTimes(50),
    getTimeTo15mLogs(30),
  ]);

  // Strength: best-set e1RM per main lift per date it was logged.
  const e1rmByLift = new Map<string, { date: string; e1rm: number }[]>();
  const byLiftDate = new Map<string, Map<string, { weightKg: number | null; reps: number | null }[]>>();
  for (const log of mainLiftLogs) {
    if (!log.isMainLift) continue;
    if (!byLiftDate.has(log.exerciseName)) byLiftDate.set(log.exerciseName, new Map());
    const byDate = byLiftDate.get(log.exerciseName)!;
    if (!byDate.has(log.date)) byDate.set(log.date, []);
    byDate.get(log.date)!.push({ weightKg: log.weightKg ? Number(log.weightKg) : null, reps: log.reps });
  }
  for (const [lift, byDate] of byLiftDate) {
    const points = [...byDate.entries()]
      .map(([date, sets]) => ({ date, e1rm: bestSetE1RM(sets) }))
      .filter((p): p is { date: string; e1rm: number } => p.e1rm !== null)
      .sort((a, b) => (a.date < b.date ? -1 : 1));
    e1rmByLift.set(lift, points);
  }

  const tonnage = computeWeeklyTonnage(mainLiftLogs);
  const hardSets = computeWeeklyHardSets(mainLiftLogs);
  const dailyLoads = computeDailySessionLoads(mainLiftLogs);
  const acwr = computeAcwr(dailyLoads);

  const cmjSeries = [...cmjTests]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((t) => ({ date: t.date, cm: Number(t.bestOf3Cm) }));
  const broadJumpSeries = [...broadJumps]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((t) => ({ date: t.date, cm: Number(t.valueCm) }));

  const weightSeries = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const rollingAvg = weightSeries.map((w, i) => {
    const window = weightSeries.slice(Math.max(0, i - 6), i + 1);
    const avg = window.reduce((s, x) => s + Number(x.kg), 0) / window.length;
    return { date: w.date, kg: Number(w.kg), avg7: Math.round(avg * 100) / 100 };
  });

  const swimEvents = ["200 Breast"];
  const splitAutopsy = swimTimes
    .filter((s) => swimEvents.includes(s.event) && s.splits && s.splits.length === 4)
    .slice(0, 5)
    .map((s) => ({ date: s.date, splits: s.splits as number[], strokeCounts: (s.strokeCounts as number[]) ?? [] }));

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1">
      <SectionLabel>Analytics</SectionLabel>
      <AnalyticsView
        e1rmByLift={Object.fromEntries(e1rmByLift)}
        liftTargets={MAIN_LIFT_TARGETS}
        tonnage={tonnage}
        hardSets={hardSets}
        dailyLoads={dailyLoads}
        acwr={acwr}
        cmjSeries={cmjSeries}
        broadJumpSeries={broadJumpSeries}
        weightSeries={rollingAvg}
        pbRows={seasonData.PB_ROWS}
        targets={seasonData.TARGETS}
        splitBars={seasonData.SPLIT_BARS}
        splitAutopsy={splitAutopsy}
        timeTo15m={timeTo15m.map((t) => ({ date: t.date, seconds: Number(t.seconds), condition: t.condition }))}
      />
    </div>
  );
}
