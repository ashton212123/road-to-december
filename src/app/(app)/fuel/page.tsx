import { SectionLabel } from "@/components/ui/SectionLabel";
import { GlassCard } from "@/components/ui/GlassCard";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { MealSlot } from "@/components/fuel/MealSlot";
import { WaterLogger } from "@/components/fuel/WaterLogger";
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
} from "@/lib/db/queries";
import { computeKcalTarget, computeProteinTargetG, sevenDayAverage } from "@/lib/fuel/targets";

export default async function FuelPage() {
  const today = todayManilaISO();
  const todayKey = todayDayKey();

  const [todaysFood, todaysWater, settingsRow, weighInHistory, allPhases, weekFood] = await Promise.all([
    getFoodLogsForDate(today),
    getWaterLogsForDate(today),
    getSettingsRow(),
    getWeighIns(21),
    getAllPhasesWithSessions(),
    getFoodLogsSince(addDaysISO(today, -6)),
  ]);

  const currentPhase = getCurrentPhase(allPhases, today);
  const kcalTarget = computeKcalTarget(today);
  const avgWeight = sevenDayAverage(weighInHistory) ?? 63;
  const proteinTarget = computeProteinTargetG(avgWeight);

  const kcalToday = todaysFood.reduce((s, f) => s + f.kcal, 0);
  const proteinToday = todaysFood.reduce((s, f) => s + Number(f.proteinG), 0);
  const waterToday = todaysWater.reduce((s, w) => s + w.ml, 0);

  const daysToBulkEnd = daysBetween(today, seasonData.meta.bulkWindowEnd);

  const banners: string[] = [];
  if (kcalTarget.isBulkWindow && daysToBulkEnd >= 0) {
    banners.push(`Bulk window: ${daysToBulkEnd} day${daysToBulkEnd === 1 ? "" : "s"} left until Aug 30.`);
  }
  if (todayKey === "wed" || todayKey === "fri") {
    banners.push("Race-pace tomorrow-morning reminder: banana or bread + water before 5 AM — never swim empty.");
  }
  if (todayKey === "tue" || todayKey === "thu" || todayKey === "sun") {
    banners.push("Post-gym: biggest meal of the day. Don't skip dinner protein tonight.");
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
    <div className="flex flex-col gap-4 rtd-fade-in pt-1">
      <SectionLabel>Fuel</SectionLabel>

      <GlassCard className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center gap-1.5">
            <ProgressRing pct={(kcalToday / kcalTarget.mid) * 100} size={68} strokeWidth={7} color="var(--rtd-orange)" />
            <div className="text-center">
              <div className="text-xs font-semibold">{kcalToday}</div>
              <div className="text-[9px] text-[var(--rtd-text-tertiary)]">/ {kcalTarget.min}-{kcalTarget.max}</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <ProgressRing pct={(proteinToday / proteinTarget.mid) * 100} size={68} strokeWidth={7} color="var(--rtd-green)" />
            <div className="text-center">
              <div className="text-xs font-semibold">{Math.round(proteinToday)}g</div>
              <div className="text-[9px] text-[var(--rtd-text-tertiary)]">/ {proteinTarget.min}-{proteinTarget.max}g</div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <ProgressRing pct={(waterToday / settingsRow.waterTargetMl) * 100} size={68} strokeWidth={7} color="var(--rtd-cyan)" />
            <div className="text-center">
              <div className="text-xs font-semibold">{(waterToday / 1000).toFixed(1)}L</div>
              <div className="text-[9px] text-[var(--rtd-text-tertiary)]">/ {(settingsRow.waterTargetMl / 1000).toFixed(1)}L</div>
            </div>
          </div>
        </div>
        {kcalTarget.needsConfirmation && (
          <div className="text-[10px] text-[var(--rtd-orange)] bg-[var(--rtd-orange)]/10 rounded-lg px-2.5 py-1.5">
            Bulk window ended — confirm a maintenance kcal target in Settings.
          </div>
        )}
      </GlassCard>

      {banners.length > 0 && (
        <div className="flex flex-col gap-2">
          {banners.map((b, i) => (
            <div key={i} className="rtd-glass px-3.5 py-2.5 text-xs text-[var(--rtd-text-secondary)]">
              {b}
            </div>
          ))}
        </div>
      )}

      <div>
        <SectionLabel>Water</SectionLabel>
        <GlassCard>
          <WaterLogger ml={waterToday} targetMl={settingsRow.waterTargetMl} />
        </GlassCard>
      </div>

      <div>
        <SectionLabel>Meal timeline</SectionLabel>
        <div className="flex flex-col gap-3">
          {mealsWithLogs.map(({ meal, logged }) => (
            <MealSlot
              key={meal.tag}
              time={meal.time}
              desc={meal.desc}
              tag={meal.tag}
              loggedItems={logged}
            />
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Weekly review</SectionLabel>
        <GlassCard className="grid grid-cols-2 gap-3">
          <div>
            <div className="rtd-micro-label">Adherence</div>
            <div className="text-lg font-semibold">{adherencePct}%</div>
          </div>
          <div>
            <div className="rtd-micro-label">Avg kcal/day</div>
            <div className="text-lg font-semibold">{avgKcalWeek}</div>
          </div>
          <div>
            <div className="rtd-micro-label">Avg protein/day</div>
            <div className="text-lg font-semibold">{avgProteinWeek}g</div>
          </div>
          <div>
            <div className="rtd-micro-label">Weight response</div>
            <div
              className="text-lg font-semibold"
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
            <div className="text-[9px] text-[var(--rtd-text-tertiary)]">target +0.25–0.3 kg/wk</div>
          </div>
        </GlassCard>
      </div>

      {currentPhase && (
        <p className="text-[10px] text-[var(--rtd-text-tertiary)] text-center pb-2">
          {currentPhase.tag} · {currentPhase.name}
        </p>
      )}
    </div>
  );
}
