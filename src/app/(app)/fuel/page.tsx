import Link from "next/link";
import dynamic from "next/dynamic";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TerminalPanel } from "@/components/ui/TerminalPanel";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { MealSlot } from "@/components/fuel/MealSlot";
import { WaterLogger } from "@/components/fuel/WaterLogger";
import { MacroDonut } from "@/components/fuel/MacroDonut";
import { MiniBarList } from "@/components/ui/MiniBarList";
import { MealQuickLog } from "@/components/fuel/MealQuickLog";
import { FuelViewSelector, type FuelView } from "@/components/fuel/FuelViewSelector";
import { seasonData } from "@/lib/data/season-data";
import { todayManilaISO, dayKeyForDate, daysBetween, addDaysISO, mondayOf } from "@/lib/time";
import {
  getFoodLogsForDate,
  getWaterLogsForDate,
  getSettingsRow,
  getWeighIns,
  getAllPhasesWithSessions,
  getCurrentPhase,
  getFoodLogsSince,
  getRecentFoodChips,
  getAllMeetsWithEvents,
} from "@/lib/db/queries";
import { computeProteinTargetG, sevenDayAverage } from "@/lib/fuel/targets";
import { computeEnergyTarget, computeAutoEnergyPhase, describePhaseTransition } from "@/lib/fuel/energyModel";
import { buildDayFuelPlan } from "@/lib/fuel/carbPeriodization";
import { deriveDaySchedule } from "@/lib/fuel/scheduleFromWeek";
import { withRetry } from "@/lib/db/withRetry";

const FuelPlanView = dynamic(() => import("@/components/fuel/FuelPlanView").then((m) => m.FuelPlanView), {
  loading: () => <div className="rtd-glass" style={{ height: 220 }} />,
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_KEY_TO_WEEK_INDEX: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  if (dateISO === addDaysISO(today, -1)) return "Yesterday";
  const d = new Date(`${dateISO}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const { date: dateParam, view: viewParam } = await searchParams;
  const view: FuelView = viewParam === "plan" || viewParam === "history" ? viewParam : "today";
  const today = todayManilaISO();
  const weekStart = mondayOf(today);

  // "Today" always pins to today (no date nav); "history" respects ?date=
  // for browsing past days; "plan" doesn't use a viewed date at all.
  const viewDate = view === "history" && dateParam && DATE_RE.test(dateParam) && daysBetween(dateParam, today) >= 0 ? dateParam : today;
  const isToday = viewDate === today;

  const [todaysFood, todaysWater, settingsRow, weighInHistory, allPhases, recentFoodLogs, recentFoodRows, allMeets] = await withRetry(() =>
    Promise.all([
      getFoodLogsForDate(viewDate),
      getWaterLogsForDate(viewDate),
      getSettingsRow(),
      getWeighIns(30),
      getAllPhasesWithSessions(),
      getFoodLogsSince(addDaysISO(today, -13)), // 14-day window: feeds computeEnergyTarget's weight-response average
      getRecentFoodChips(addDaysISO(today, -14)),
      getAllMeetsWithEvents(),
    ])
  );

  const currentPhase = getCurrentPhase(allPhases, today);

  const nextMeetDate = allMeets.filter((m) => m.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1))[0]?.date ?? null;
  const energyPhase =
    settingsRow.energyPhase ??
    computeAutoEnergyPhase({ todayISO: today, bulkWindowEndISO: seasonData.meta.bulkWindowEnd, firstMeetDateISO: nextMeetDate });
  const kcalByDate = new Map<string, number>();
  for (const f of recentFoodLogs) kcalByDate.set(f.date, (kcalByDate.get(f.date) ?? 0) + f.kcal);
  const energyTarget = computeEnergyTarget({
    todayISO: today,
    energyPhase,
    kcalTargetOverride: settingsRow.kcalTargetOverride,
    weighIns: weighInHistory.map((w) => ({ date: w.date, kg: Number(w.kg) })),
    recentKcal: [...kcalByDate.entries()].map(([date, kcal]) => ({ date, kcal })),
  });

  const avgWeight = sevenDayAverage(weighInHistory) ?? 63;
  const proteinTarget = computeProteinTargetG(avgWeight);

  // The viewed day's own schedule sets its demand (carb target); bodyweight
  // and the energy target itself are always today's -- reconstructing a
  // historically-accurate weight-response target per past day isn't worth
  // the complexity at this scale (see energyModel.ts's doc comment).
  const viewDateSchedule = deriveDaySchedule(seasonData.WEEK[DAY_KEY_TO_WEEK_INDEX[dayKeyForDate(viewDate)]]);
  const dayFuelPlan = buildDayFuelPlan({ dateISO: viewDate, bodyweightKg: avgWeight, energyTarget, ...viewDateSchedule });

  const kcalToday = todaysFood.reduce((s, f) => s + f.kcal, 0);
  const proteinToday = todaysFood.reduce((s, f) => s + Number(f.proteinG), 0);
  const carbsToday = todaysFood.reduce((s, f) => s + Number(f.carbsG ?? 0), 0);
  const fatToday = todaysFood.reduce((s, f) => s + Number(f.fatG ?? 0), 0);
  const waterToday = todaysWater.reduce((s, w) => s + w.ml, 0);
  const carbsTargetG = dayFuelPlan.carbsG;
  const fatTargetG = dayFuelPlan.fatG;
  const kcalTargetMid = dayFuelPlan.kcal;

  const daysToBulkEnd = daysBetween(today, seasonData.meta.bulkWindowEnd);

  const banners: string[] = [];
  if (isToday) {
    if (energyPhase === "gain" && daysToBulkEnd >= 0) {
      banners.push(`Gain phase ends Aug 30 (${daysToBulkEnd} day${daysToBulkEnd === 1 ? "" : "s"} left) — targets move to maintenance automatically.`);
    }
  }

  // Weekly review
  const weekWeighIns = weighInHistory.filter((w) => w.date >= addDaysISO(today, -6));
  const weightDelta =
    weekWeighIns.length >= 2
      ? Number(weekWeighIns[0].kg) - Number(weekWeighIns[weekWeighIns.length - 1].kg)
      : null;
  const weekFood = recentFoodLogs.filter((f) => f.date >= addDaysISO(today, -6));
  const daysWithFood = new Set(weekFood.map((f) => f.date)).size;
  const adherencePct = Math.round((daysWithFood / 7) * 100);
  const avgKcalWeek = weekFood.length ? Math.round(weekFood.reduce((s, f) => s + f.kcal, 0) / 7) : 0;
  const avgProteinWeek = weekFood.length
    ? Math.round(weekFood.reduce((s, f) => s + Number(f.proteinG), 0) / 7)
    : 0;

  // 38.5: only the meal slots he actually logged something in -- no empty-slot prescription.
  const mealsWithLogs = seasonData.MEALS.map((meal) => ({
    meal,
    logged: todaysFood
      .filter((f) => f.timeSlot === meal.tag)
      .map((f) => ({ id: f.id, description: f.description, kcal: f.kcal, proteinG: f.proteinG })),
  })).filter(({ logged }) => logged.length > 0);

  const proteinByMealSlot = mealsWithLogs
    .map(({ meal, logged }) => ({
      label: meal.desc,
      value: Math.round(logged.reduce((s, f) => s + Number(f.proteinG), 0)),
    }))
    .filter((r) => r.value > 0);

  // Plan view: this week's 7-day plan + the weight-trend chart.
  const weekPlan =
    view === "plan"
      ? Array.from({ length: 7 }, (_, i) => {
          const dateISO = addDaysISO(weekStart, i);
          const dayKey = dayKeyForDate(dateISO);
          const schedule = deriveDaySchedule(seasonData.WEEK[DAY_KEY_TO_WEEK_INDEX[dayKey]]);
          return buildDayFuelPlan({ dateISO, bodyweightKg: avgWeight, energyTarget, ...schedule });
        })
      : [];
  const weightTrendSeries = [...weighInHistory]
    .filter((w) => w.date >= addDaysISO(today, -27))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((w) => ({ date: w.date, kg: Number(w.kg) }));
  const { daysLeft: phaseDaysLeft, explainer: phaseTransitionExplainer } = describePhaseTransition({
    todayISO: today,
    phase: energyTarget.phase,
    bulkWindowEndISO: seasonData.meta.bulkWindowEnd,
    nextMeetDateISO: nextMeetDate,
  });

  return (
    <div className="flex flex-col gap-3 pt-1">
      <SectionHeader
        title="Fuel"
        className="mb-2"
        statusChip={
          view === "history" ? (
            <div className="flex items-center gap-1">
              <Link
                href={`/fuel?view=history&date=${addDaysISO(viewDate, -1)}`}
                aria-label="Previous day"
                className="rtd-tap-target w-7 h-7 flex items-center justify-center rounded-full text-[var(--rtd-text-secondary)] cursor-pointer hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
              >
                ‹
              </Link>
              <span className="text-footnote font-medium text-[var(--rtd-text-secondary)] min-w-[64px] text-center">
                {formatDateLabel(viewDate, today)}
              </span>
              {isToday ? (
                <span className="rtd-tap-target w-7 h-7 flex items-center justify-center rounded-full text-[var(--rtd-text-tertiary)]" aria-hidden="true">
                  ›
                </span>
              ) : (
                <Link
                  href={`/fuel?view=history&date=${addDaysISO(viewDate, 1)}`}
                  aria-label="Next day"
                  className="rtd-tap-target w-7 h-7 flex items-center justify-center rounded-full text-[var(--rtd-text-secondary)] cursor-pointer hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
                >
                  ›
                </Link>
              )}
            </div>
          ) : undefined
        }
      />

      <FuelViewSelector current={view} />

      {view === "plan" ? (
        <FuelPlanView
          energyTarget={energyTarget}
          phaseDaysLeft={phaseDaysLeft}
          phaseTransitionExplainer={phaseTransitionExplainer}
          weightTrend={weightTrendSeries}
          weekPlan={weekPlan}
          todayISO={today}
          proteinTargetG={proteinTarget}
          proteinByMealSlotToday={proteinByMealSlot}
        />
      ) : (
        <>
          {view === "history" && !isToday && (
            <div className="text-caption text-[var(--rtd-text-tertiary)] -mt-2">
              Viewing a past day — read-only. Logging is only available for today.
            </div>
          )}

          {banners.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {banners.map((b, i) => (
                <div key={i} className="rtd-strip bg-[var(--rtd-orange)]/10 text-[var(--rtd-text)]">
                  <span aria-hidden="true" className="text-[var(--rtd-orange)] shrink-0">⚠</span>
                  <span className="truncate">{b}</span>
                </div>
              ))}
            </div>
          )}

          <div className="rtd-bento-grid">
            <TerminalPanel variant="open" colSpan={8} rowSpan={2} label="Today's intake">
              <div className="grid grid-cols-3 gap-2 flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5">
                  <ProgressRing
                    pct={(kcalToday / kcalTargetMid) * 100}
                    size={72}
                    strokeWidth={7}
                    gradient={["var(--rtd-orange)", "#ff375f"]}
                    glow
                    ariaLabel={`Calories: ${kcalToday} of ${energyTarget.low} to ${energyTarget.high}`}
                  />
                  <div className="text-center">
                    <div className="text-footnote font-semibold rtd-nums rtd-mono"><AnimatedNumber value={kcalToday} /></div>
                    <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums rtd-mono">/ {energyTarget.low}-{energyTarget.high}</div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <ProgressRing
                    pct={(proteinToday / proteinTarget.mid) * 100}
                    size={72}
                    strokeWidth={7}
                    gradient={["var(--rtd-green)", "var(--rtd-teal)"]}
                    glow
                    ariaLabel={`Protein: ${Math.round(proteinToday)} of ${proteinTarget.min} to ${proteinTarget.max} grams`}
                  />
                  <div className="text-center">
                    <div className="text-footnote font-semibold rtd-nums rtd-mono"><AnimatedNumber value={Math.round(proteinToday)} />g</div>
                    <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums rtd-mono">/ {proteinTarget.min}-{proteinTarget.max}g</div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <ProgressRing
                    pct={(waterToday / settingsRow.waterTargetMl) * 100}
                    size={72}
                    strokeWidth={7}
                    gradient={["var(--rtd-cyan)", "var(--rtd-blue)"]}
                    glow
                    ariaLabel={`Water: ${(waterToday / 1000).toFixed(1)} of ${(settingsRow.waterTargetMl / 1000).toFixed(1)} liters`}
                  />
                  <div className="text-center">
                    <div className="text-footnote font-semibold rtd-nums rtd-mono"><AnimatedNumber value={waterToday / 1000} decimals={1} suffix="L" /></div>
                    <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums rtd-mono">/ {(settingsRow.waterTargetMl / 1000).toFixed(1)}L</div>
                  </div>
                </div>
              </div>
            </TerminalPanel>

            <TerminalPanel colSpan={4} rowSpan={2} label="Water">
              <WaterLogger ml={waterToday} targetMl={settingsRow.waterTargetMl} readOnly={!isToday} />
            </TerminalPanel>

            {isToday ? (
              <div id="quick-log" style={{ gridColumn: "span 7 / span 7", gridRow: "span 3 / span 3" }} className="flex flex-col min-h-0">
                <SectionHeader title="Quick log" className="mb-2" />
                <div className="flex-1 min-h-0">
                  <MealQuickLog
                    recentFoods={recentFoodRows.map((r) => ({
                      description: r.description,
                      timeSlot: r.timeSlot,
                      kcal: r.kcal,
                      proteinG: Number(r.proteinG),
                      carbsG: r.carbsG !== null ? Number(r.carbsG) : 0,
                      fatG: r.fatG !== null ? Number(r.fatG) : 0,
                    }))}
                  />
                </div>
              </div>
            ) : (
              <TerminalPanel colSpan={7} rowSpan={3} label="Quick log">
                <div className="flex-1 flex items-center justify-center text-caption text-[var(--rtd-text-tertiary)]">
                  Logging is only available for today.
                </div>
              </TerminalPanel>
            )}

            <TerminalPanel variant="open" colSpan={5} rowSpan={3} label="Macros">
              <MacroDonut
                kcalLogged={kcalToday}
                kcalTarget={kcalTargetMid}
                proteinLoggedG={proteinToday}
                proteinTargetG={proteinTarget.mid}
                carbsLoggedG={carbsToday}
                carbsTargetG={carbsTargetG}
                fatLoggedG={fatToday}
                fatTargetG={fatTargetG}
              />
              {proteinByMealSlot.length > 0 && (
                <div className="mt-2">
                  <div className="rtd-micro-label mb-1.5">Protein by meal</div>
                  <MiniBarList rows={proteinByMealSlot} color="var(--rtd-green)" formatValue={(v) => `${v}g`} />
                </div>
              )}
            </TerminalPanel>

            {mealsWithLogs.length > 0 && (
              <div style={{ gridColumn: "span 7 / span 7", gridRow: "span 3 / span 3" }} className="flex flex-col min-h-0 gap-2">
                <SectionHeader title="Today's meals" className="mb-2" />
                <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
                  {mealsWithLogs.map(({ meal, logged }) => (
                    <MealSlot key={meal.tag} time={meal.time} desc={meal.desc} tag={meal.tag} loggedItems={logged} readOnly={!isToday} />
                  ))}
                </div>
              </div>
            )}

            <TerminalPanel colSpan={5} rowSpan={3} label="Weekly review">
              <div className="grid grid-cols-2 gap-3 flex-1">
                <div>
                  <div className="rtd-micro-label">Adherence</div>
                  <div className="text-title-3 rtd-nums rtd-mono">{adherencePct}%</div>
                </div>
                <div>
                  <div className="rtd-micro-label">Avg kcal/day</div>
                  <div className="text-title-3 rtd-nums rtd-mono">{avgKcalWeek}</div>
                </div>
                <div>
                  <div className="rtd-micro-label">Avg protein/day</div>
                  <div className="text-title-3 rtd-nums rtd-mono">{avgProteinWeek}g</div>
                </div>
                <div>
                  <div className="rtd-micro-label">Weight response</div>
                  <div
                    className="text-title-3 rtd-nums rtd-mono"
                    style={{
                      color:
                        weightDelta === null
                          ? undefined
                          : weightDelta >= 0.2 && weightDelta <= 0.4
                            ? "var(--rtd-green)"
                            : "var(--rtd-orange)",
                    }}
                  >
                    {weightDelta === null ? "—" : `${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(2)} kg`}
                  </div>
                  <div className="text-caption text-[var(--rtd-text-secondary)]">target {energyTarget.targetRateKgPerWk >= 0 ? "+" : ""}{energyTarget.targetRateKgPerWk.toFixed(2)} kg/wk</div>
                </div>
              </div>
            </TerminalPanel>
          </div>

          {/* Mobile stack */}
          <div className="flex flex-col gap-4 md:hidden">
            <div className="rtd-open-section flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col items-center gap-1.5">
                  <ProgressRing pct={(kcalToday / kcalTargetMid) * 100} size={68} strokeWidth={7} gradient={["var(--rtd-orange)", "#ff375f"]} glow ariaLabel={`Calories: ${kcalToday} of ${energyTarget.low} to ${energyTarget.high}`} />
                  <div className="text-center">
                    <div className="text-footnote font-semibold rtd-nums rtd-mono"><AnimatedNumber value={kcalToday} /></div>
                    <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums rtd-mono">/ {energyTarget.low}-{energyTarget.high}</div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <ProgressRing pct={(proteinToday / proteinTarget.mid) * 100} size={68} strokeWidth={7} gradient={["var(--rtd-green)", "var(--rtd-teal)"]} glow ariaLabel={`Protein: ${Math.round(proteinToday)} of ${proteinTarget.min} to ${proteinTarget.max} grams`} />
                  <div className="text-center">
                    <div className="text-footnote font-semibold rtd-nums rtd-mono"><AnimatedNumber value={Math.round(proteinToday)} />g</div>
                    <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums rtd-mono">/ {proteinTarget.min}-{proteinTarget.max}g</div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <ProgressRing pct={(waterToday / settingsRow.waterTargetMl) * 100} size={68} strokeWidth={7} gradient={["var(--rtd-cyan)", "var(--rtd-blue)"]} glow ariaLabel={`Water: ${(waterToday / 1000).toFixed(1)} of ${(settingsRow.waterTargetMl / 1000).toFixed(1)} liters`} />
                  <div className="text-center">
                    <div className="text-footnote font-semibold rtd-nums rtd-mono"><AnimatedNumber value={waterToday / 1000} decimals={1} suffix="L" /></div>
                    <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums rtd-mono">/ {(settingsRow.waterTargetMl / 1000).toFixed(1)}L</div>
                  </div>
                </div>
              </div>
            </div>

            {isToday && (
              <div id="quick-log-mobile">
                <SectionHeader title="Quick log" className="mb-2" />
                <MealQuickLog
                  recentFoods={recentFoodRows.map((r) => ({
                    description: r.description,
                    timeSlot: r.timeSlot,
                    kcal: r.kcal,
                    proteinG: Number(r.proteinG),
                    carbsG: r.carbsG !== null ? Number(r.carbsG) : 0,
                    fatG: r.fatG !== null ? Number(r.fatG) : 0,
                  }))}
                />
              </div>
            )}

            <div>
              <SectionHeader title="Water" className="mb-2" />
              <div className="rtd-glass p-4">
                <WaterLogger ml={waterToday} targetMl={settingsRow.waterTargetMl} readOnly={!isToday} />
              </div>
            </div>

            <div>
              <SectionHeader title="Macros" className="mb-2" />
              <div className="rtd-open-section">
                <MacroDonut
                  kcalLogged={kcalToday}
                  kcalTarget={kcalTargetMid}
                  proteinLoggedG={proteinToday}
                  proteinTargetG={proteinTarget.mid}
                  carbsLoggedG={carbsToday}
                  carbsTargetG={carbsTargetG}
                  fatLoggedG={fatToday}
                  fatTargetG={fatTargetG}
                />
                {proteinByMealSlot.length > 0 && (
                  <div className="mt-2">
                    <div className="rtd-micro-label mb-1.5">Protein by meal</div>
                    <MiniBarList rows={proteinByMealSlot} color="var(--rtd-green)" formatValue={(v) => `${v}g`} />
                  </div>
                )}
              </div>
            </div>

            {mealsWithLogs.length > 0 && (
              <div>
                <SectionHeader title="Today's meals" className="mb-2" />
                <div className="flex flex-col gap-3">
                  {mealsWithLogs.map(({ meal, logged }) => (
                    <MealSlot key={meal.tag} time={meal.time} desc={meal.desc} tag={meal.tag} loggedItems={logged} readOnly={!isToday} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <SectionHeader title="Weekly review" className="mb-2" />
              <div className="rtd-glass p-4 grid grid-cols-2 gap-3">
                <div>
                  <div className="rtd-micro-label">Adherence</div>
                  <div className="text-title-3 rtd-nums rtd-mono">{adherencePct}%</div>
                </div>
                <div>
                  <div className="rtd-micro-label">Avg kcal/day</div>
                  <div className="text-title-3 rtd-nums rtd-mono">{avgKcalWeek}</div>
                </div>
                <div>
                  <div className="rtd-micro-label">Avg protein/day</div>
                  <div className="text-title-3 rtd-nums rtd-mono">{avgProteinWeek}g</div>
                </div>
                <div>
                  <div className="rtd-micro-label">Weight response</div>
                  <div
                    className="text-title-3 rtd-nums rtd-mono"
                    style={{
                      color:
                        weightDelta === null
                          ? undefined
                          : weightDelta >= 0.2 && weightDelta <= 0.4
                            ? "var(--rtd-green)"
                            : "var(--rtd-orange)",
                    }}
                  >
                    {weightDelta === null ? "—" : `${weightDelta >= 0 ? "+" : ""}${weightDelta.toFixed(2)} kg`}
                  </div>
                  <div className="text-caption text-[var(--rtd-text-secondary)]">target {energyTarget.targetRateKgPerWk >= 0 ? "+" : ""}{energyTarget.targetRateKgPerWk.toFixed(2)} kg/wk</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {currentPhase && (
        <p className="text-caption text-[var(--rtd-text-secondary)] text-center pb-2">
          {currentPhase.tag} · {currentPhase.name}
        </p>
      )}
    </div>
  );
}
