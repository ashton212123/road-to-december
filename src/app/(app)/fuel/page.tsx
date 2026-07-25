import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { BentoCard } from "@/components/ui/BentoCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { MealSlot } from "@/components/fuel/MealSlot";
import { WaterLogger } from "@/components/fuel/WaterLogger";
import { MacroDonut } from "@/components/fuel/MacroDonut";
import { MiniBarList } from "@/components/ui/MiniBarList";
import { MealQuickLog } from "@/components/fuel/MealQuickLog";
import { seasonData } from "@/lib/data/season-data";
import { todayManilaISO, todayDayKey, daysBetween, addDaysISO } from "@/lib/time";
import {
  getFoodLogsForDate,
  getWaterLogsForDate,
  getSettingsRow,
  getWeighIns,
  getAllPhasesWithSessions,
  getCurrentPhase,
  getFoodLogsSince,
  getRecentFoodChips,
} from "@/lib/db/queries";
import { computeKcalTarget, computeProteinTargetG, computeCarbsAndFatTargetG, sevenDayAverage } from "@/lib/fuel/targets";
import { withRetry } from "@/lib/db/withRetry";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatDateLabel(dateISO: string, today: string): string {
  if (dateISO === today) return "Today";
  if (dateISO === addDaysISO(today, -1)) return "Yesterday";
  const d = new Date(`${dateISO}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default async function FuelPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const today = todayManilaISO();
  const todayKey = todayDayKey();
  const viewDate = dateParam && DATE_RE.test(dateParam) && daysBetween(dateParam, today) >= 0 ? dateParam : today;
  const isToday = viewDate === today;

  const [todaysFood, todaysWater, settingsRow, weighInHistory, allPhases, weekFood, recentFoodRows] = await withRetry(() =>
    Promise.all([
      getFoodLogsForDate(viewDate),
      getWaterLogsForDate(viewDate),
      getSettingsRow(),
      getWeighIns(21),
      getAllPhasesWithSessions(),
      getFoodLogsSince(addDaysISO(today, -6)),
      getRecentFoodChips(addDaysISO(today, -14)),
    ])
  );

  const currentPhase = getCurrentPhase(allPhases, today);
  const kcalTarget = computeKcalTarget(viewDate);
  const avgWeight = sevenDayAverage(weighInHistory) ?? 63;
  const proteinTarget = computeProteinTargetG(avgWeight);

  const kcalToday = todaysFood.reduce((s, f) => s + f.kcal, 0);
  const proteinToday = todaysFood.reduce((s, f) => s + Number(f.proteinG), 0);
  const carbsToday = todaysFood.reduce((s, f) => s + Number(f.carbsG ?? 0), 0);
  const fatToday = todaysFood.reduce((s, f) => s + Number(f.fatG ?? 0), 0);
  const waterToday = todaysWater.reduce((s, w) => s + w.ml, 0);
  const { carbsG: carbsTargetG, fatG: fatTargetG } = computeCarbsAndFatTargetG(kcalTarget.mid, proteinTarget.mid);

  const daysToBulkEnd = daysBetween(today, seasonData.meta.bulkWindowEnd);

  const banners: string[] = [];
  if (isToday) {
    if (kcalTarget.isBulkWindow && daysToBulkEnd >= 0) {
      banners.push(`Bulk window: ${daysToBulkEnd} day${daysToBulkEnd === 1 ? "" : "s"} left until Aug 30.`);
    }
    if (todayKey === "wed" || todayKey === "fri") {
      banners.push("Race-pace tomorrow-morning reminder: banana or bread + water before 5 AM — never swim empty.");
    }
    if (todayKey === "tue" || todayKey === "thu" || todayKey === "sun") {
      banners.push("Post-gym: biggest meal of the day. Don't skip dinner protein tonight.");
    }
  }
  if (kcalTarget.needsConfirmation) {
    banners.push("Bulk window ended — confirm a maintenance kcal target in Settings.");
  }

  // Weekly review
  const weekWeighIns = weighInHistory.filter((w) => w.date >= addDaysISO(today, -6));
  const weightDelta =
    weekWeighIns.length >= 2
      ? Number(weekWeighIns[0].kg) - Number(weekWeighIns[weekWeighIns.length - 1].kg)
      : null;
  const daysWithFood = new Set(weekFood.map((f) => f.date)).size;
  const adherencePct = Math.round((daysWithFood / 7) * 100);
  const avgKcalWeek = weekFood.length ? Math.round(weekFood.reduce((s, f) => s + f.kcal, 0) / 7) : 0;
  const avgProteinWeek = weekFood.length
    ? Math.round(weekFood.reduce((s, f) => s + Number(f.proteinG), 0) / 7)
    : 0;

  const mealsWithLogs = seasonData.MEALS.map((meal) => ({
    meal,
    logged: todaysFood
      .filter((f) => f.timeSlot === meal.tag)
      .map((f) => ({ id: f.id, description: f.description, kcal: f.kcal, proteinG: f.proteinG })),
  }));

  const proteinByMealSlot = mealsWithLogs
    .map(({ meal, logged }) => ({
      label: meal.desc,
      value: Math.round(logged.reduce((s, f) => s + Number(f.proteinG), 0)),
    }))
    .filter((r) => r.value > 0);

  return (
    <div className="flex flex-col gap-3 pt-1">
      <SectionLabel
        right={
          <div className="flex items-center gap-1">
            <Link
              href={`/fuel?date=${addDaysISO(viewDate, -1)}`}
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
                href={`/fuel?date=${addDaysISO(viewDate, 1)}`}
                aria-label="Next day"
                className="rtd-tap-target w-7 h-7 flex items-center justify-center rounded-full text-[var(--rtd-text-secondary)] cursor-pointer hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-[var(--rtd-blue)] focus-visible:outline-offset-2 active:scale-[0.98] transition-transform duration-150 ease-out"
              >
                ›
              </Link>
            )}
          </div>
        }
      >
        Fuel
      </SectionLabel>
      {!isToday && (
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
        <BentoCard variant="open" colSpan={8} rowSpan={2} label="Today's intake">
          <div className="grid grid-cols-3 gap-2 flex-1 items-center">
            <div className="flex flex-col items-center gap-1.5">
              <ProgressRing
                pct={(kcalToday / kcalTarget.mid) * 100}
                size={72}
                strokeWidth={7}
                gradient={["var(--rtd-orange)", "#ff375f"]}
                glow
                ariaLabel={`Calories: ${kcalToday} of ${kcalTarget.min} to ${kcalTarget.max}`}
              />
              <div className="text-center">
                <div className="text-footnote font-semibold rtd-nums"><AnimatedNumber value={kcalToday} /></div>
                <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums">/ {kcalTarget.min}-{kcalTarget.max}</div>
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
                <div className="text-footnote font-semibold rtd-nums"><AnimatedNumber value={Math.round(proteinToday)} />g</div>
                <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums">/ {proteinTarget.min}-{proteinTarget.max}g</div>
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
                <div className="text-footnote font-semibold rtd-nums"><AnimatedNumber value={waterToday / 1000} decimals={1} suffix="L" /></div>
                <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums">/ {(settingsRow.waterTargetMl / 1000).toFixed(1)}L</div>
              </div>
            </div>
          </div>
        </BentoCard>

        <BentoCard colSpan={4} rowSpan={2} label="Water">
          <WaterLogger ml={waterToday} targetMl={settingsRow.waterTargetMl} readOnly={!isToday} />
        </BentoCard>

        {isToday ? (
          <div id="quick-log" style={{ gridColumn: "span 7 / span 7", gridRow: "span 3 / span 3" }} className="flex flex-col min-h-0">
            <SectionLabel>Quick log</SectionLabel>
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
          <BentoCard colSpan={7} rowSpan={3} label="Quick log">
            <div className="flex-1 flex items-center justify-center text-caption text-[var(--rtd-text-tertiary)]">
              Logging is only available for today.
            </div>
          </BentoCard>
        )}

        <BentoCard variant="open" colSpan={5} rowSpan={3} label="Macros">
          <MacroDonut
            kcalLogged={kcalToday}
            kcalTarget={kcalTarget.mid}
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
        </BentoCard>

        <div style={{ gridColumn: "span 7 / span 7", gridRow: "span 3 / span 3" }} className="flex flex-col min-h-0 gap-2">
          <SectionLabel>Meal timeline</SectionLabel>
          <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0">
            {mealsWithLogs.map(({ meal, logged }) => (
              <MealSlot key={meal.tag} time={meal.time} desc={meal.desc} tag={meal.tag} loggedItems={logged} readOnly={!isToday} />
            ))}
          </div>
        </div>

        <BentoCard colSpan={5} rowSpan={3} label="Weekly review">
          <div className="grid grid-cols-2 gap-3 flex-1">
            <div>
              <div className="rtd-micro-label">Adherence</div>
              <div className="text-title-3 rtd-nums">{adherencePct}%</div>
            </div>
            <div>
              <div className="rtd-micro-label">Avg kcal/day</div>
              <div className="text-title-3 rtd-nums">{avgKcalWeek}</div>
            </div>
            <div>
              <div className="rtd-micro-label">Avg protein/day</div>
              <div className="text-title-3 rtd-nums">{avgProteinWeek}g</div>
            </div>
            <div>
              <div className="rtd-micro-label">Weight response</div>
              <div
                className="text-title-3 rtd-nums"
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
              <div className="text-caption text-[var(--rtd-text-secondary)]">target +0.25–0.3 kg/wk</div>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Mobile stack */}
      <div className="flex flex-col gap-4 md:hidden">
        <div className="rtd-open-section flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center gap-1.5">
              <ProgressRing pct={(kcalToday / kcalTarget.mid) * 100} size={68} strokeWidth={7} gradient={["var(--rtd-orange)", "#ff375f"]} glow ariaLabel={`Calories: ${kcalToday} of ${kcalTarget.min} to ${kcalTarget.max}`} />
              <div className="text-center">
                <div className="text-footnote font-semibold rtd-nums"><AnimatedNumber value={kcalToday} /></div>
                <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums">/ {kcalTarget.min}-{kcalTarget.max}</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <ProgressRing pct={(proteinToday / proteinTarget.mid) * 100} size={68} strokeWidth={7} gradient={["var(--rtd-green)", "var(--rtd-teal)"]} glow ariaLabel={`Protein: ${Math.round(proteinToday)} of ${proteinTarget.min} to ${proteinTarget.max} grams`} />
              <div className="text-center">
                <div className="text-footnote font-semibold rtd-nums"><AnimatedNumber value={Math.round(proteinToday)} />g</div>
                <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums">/ {proteinTarget.min}-{proteinTarget.max}g</div>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <ProgressRing pct={(waterToday / settingsRow.waterTargetMl) * 100} size={68} strokeWidth={7} gradient={["var(--rtd-cyan)", "var(--rtd-blue)"]} glow ariaLabel={`Water: ${(waterToday / 1000).toFixed(1)} of ${(settingsRow.waterTargetMl / 1000).toFixed(1)} liters`} />
              <div className="text-center">
                <div className="text-footnote font-semibold rtd-nums"><AnimatedNumber value={waterToday / 1000} decimals={1} suffix="L" /></div>
                <div className="text-caption text-[var(--rtd-text-secondary)] rtd-nums">/ {(settingsRow.waterTargetMl / 1000).toFixed(1)}L</div>
              </div>
            </div>
          </div>
        </div>

        {isToday && (
          <div id="quick-log-mobile">
            <SectionLabel>Quick log</SectionLabel>
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
          <SectionLabel>Water</SectionLabel>
          <div className="rtd-glass p-4">
            <WaterLogger ml={waterToday} targetMl={settingsRow.waterTargetMl} readOnly={!isToday} />
          </div>
        </div>

        <div>
          <SectionLabel>Macros</SectionLabel>
          <div className="rtd-open-section">
            <MacroDonut
              kcalLogged={kcalToday}
              kcalTarget={kcalTarget.mid}
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

        <div>
          <SectionLabel>Meal timeline</SectionLabel>
          <div className="flex flex-col gap-3">
            {mealsWithLogs.map(({ meal, logged }) => (
              <MealSlot key={meal.tag} time={meal.time} desc={meal.desc} tag={meal.tag} loggedItems={logged} readOnly={!isToday} />
            ))}
          </div>
        </div>

        <div>
          <SectionLabel>Weekly review</SectionLabel>
          <div className="rtd-glass p-4 grid grid-cols-2 gap-3">
            <div>
              <div className="rtd-micro-label">Adherence</div>
              <div className="text-title-3 rtd-nums">{adherencePct}%</div>
            </div>
            <div>
              <div className="rtd-micro-label">Avg kcal/day</div>
              <div className="text-title-3 rtd-nums">{avgKcalWeek}</div>
            </div>
            <div>
              <div className="rtd-micro-label">Avg protein/day</div>
              <div className="text-title-3 rtd-nums">{avgProteinWeek}g</div>
            </div>
            <div>
              <div className="rtd-micro-label">Weight response</div>
              <div
                className="text-title-3 rtd-nums"
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
              <div className="text-caption text-[var(--rtd-text-secondary)]">target +0.25–0.3 kg/wk</div>
            </div>
          </div>
        </div>
      </div>

      {currentPhase && (
        <p className="text-caption text-[var(--rtd-text-secondary)] text-center pb-2">
          {currentPhase.tag} · {currentPhase.name}
        </p>
      )}
    </div>
  );
}
