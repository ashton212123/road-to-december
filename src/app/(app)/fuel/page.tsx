import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { MealSlot } from "@/components/fuel/MealSlot";
import { WaterLogger } from "@/components/fuel/WaterLogger";
import { MacroDonut } from "@/components/fuel/MacroDonut";
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

  return (
    <div className="flex flex-col gap-4 rtd-fade-in pt-1 md:grid md:grid-cols-12 md:gap-6 md:items-start">
      <div className="md:col-span-12 md:row-start-1">
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
          <div className="text-caption text-[var(--rtd-text-tertiary)] -mt-1">
            Viewing a past day — read-only. Logging is only available for today.
          </div>
        )}
      </div>

      {/* Left column (desktop): rings, macros, weekly review */}
      <GlassCard className="flex flex-col gap-4 md:col-start-1 md:col-span-5 md:row-start-2">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1.5">
            <ProgressRing
              pct={(kcalToday / kcalTarget.mid) * 100}
              size={68}
              strokeWidth={7}
              color="var(--rtd-orange)"
              className="w-[68px] h-[68px] md:w-24 md:h-24"
              ariaLabel={`Calories: ${kcalToday} of ${kcalTarget.min} to ${kcalTarget.max}`}
            />
            <div className="text-center">
              <div className="text-footnote font-semibold">
                <AnimatedNumber value={kcalToday} />
              </div>
              <div className="text-caption text-[var(--rtd-text-secondary)]">/ {kcalTarget.min}-{kcalTarget.max}</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <ProgressRing
              pct={(proteinToday / proteinTarget.mid) * 100}
              size={68}
              strokeWidth={7}
              color="var(--rtd-green)"
              className="w-[68px] h-[68px] md:w-24 md:h-24"
              ariaLabel={`Protein: ${Math.round(proteinToday)} of ${proteinTarget.min} to ${proteinTarget.max} grams`}
            />
            <div className="text-center">
              <div className="text-footnote font-semibold">
                <AnimatedNumber value={Math.round(proteinToday)} />g
              </div>
              <div className="text-caption text-[var(--rtd-text-secondary)]">/ {proteinTarget.min}-{proteinTarget.max}g</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <ProgressRing
              pct={(waterToday / settingsRow.waterTargetMl) * 100}
              size={68}
              strokeWidth={7}
              color="var(--rtd-cyan)"
              className="w-[68px] h-[68px] md:w-24 md:h-24"
              ariaLabel={`Water: ${(waterToday / 1000).toFixed(1)} of ${(settingsRow.waterTargetMl / 1000).toFixed(1)} liters`}
            />
            <div className="text-center">
              <div className="text-footnote font-semibold">
                <AnimatedNumber value={waterToday / 1000} decimals={1} suffix="L" />
              </div>
              <div className="text-caption text-[var(--rtd-text-secondary)]">/ {(settingsRow.waterTargetMl / 1000).toFixed(1)}L</div>
            </div>
          </div>
        </div>
        {kcalTarget.needsConfirmation && (
          <div className="text-caption text-[var(--rtd-orange)] bg-[var(--rtd-orange)]/10 rounded-lg px-2.5 py-1.5">
            Bulk window ended — confirm a maintenance kcal target in Settings.
          </div>
        )}
      </GlassCard>

      <div className="md:col-start-1 md:col-span-5 md:row-start-3">
        <SectionLabel>Macros</SectionLabel>
        <GlassCard>
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
        </GlassCard>
      </div>

      {/* Right column (desktop): quick log, banners, water, meal timeline */}
      {isToday && (
        <div className="md:col-start-6 md:col-span-7 md:row-start-2">
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

      {banners.length > 0 && (
        <div className="flex flex-col gap-2 md:col-start-6 md:col-span-7 md:row-start-3">
          {banners.map((b, i) => (
            <div key={i} className="rtd-glass px-3.5 py-2.5 text-footnote text-[var(--rtd-text-secondary)]">
              {b}
            </div>
          ))}
        </div>
      )}

      <div className="md:col-start-6 md:col-span-7 md:row-start-4">
        <SectionLabel>Water</SectionLabel>
        <GlassCard>
          <WaterLogger ml={waterToday} targetMl={settingsRow.waterTargetMl} readOnly={!isToday} />
        </GlassCard>
      </div>

      <div className="md:col-start-6 md:col-span-7 md:row-start-5">
        <SectionLabel>Meal timeline</SectionLabel>
        <div className="flex flex-col gap-3">
          {mealsWithLogs.map(({ meal, logged }) => (
            <MealSlot
              key={meal.tag}
              time={meal.time}
              desc={meal.desc}
              tag={meal.tag}
              loggedItems={logged}
              readOnly={!isToday}
            />
          ))}
        </div>
      </div>

      <div className="md:col-start-1 md:col-span-5 md:row-start-4">
        <SectionLabel>Weekly review</SectionLabel>
        <GlassCard className="grid grid-cols-2 gap-3">
          <div>
            <div className="rtd-micro-label">Adherence</div>
            <div className="text-title-3">{adherencePct}%</div>
          </div>
          <div>
            <div className="rtd-micro-label">Avg kcal/day</div>
            <div className="text-title-3">{avgKcalWeek}</div>
          </div>
          <div>
            <div className="rtd-micro-label">Avg protein/day</div>
            <div className="text-title-3">{avgProteinWeek}g</div>
          </div>
          <div>
            <div className="rtd-micro-label">Weight response</div>
            <div
              className="text-title-3"
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
        </GlassCard>
      </div>

      {currentPhase && (
        <p className="text-caption text-[var(--rtd-text-secondary)] text-center pb-2 md:col-span-12 md:row-start-6">
          {currentPhase.tag} · {currentPhase.name}
        </p>
      )}
    </div>
  );
}
