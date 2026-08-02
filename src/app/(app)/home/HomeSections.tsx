import { Suspense } from "react";
import { AlertCardList } from "@/components/rules/AlertCardList";
import { NeedsAttentionList } from "@/components/home/NeedsAttentionList";
import { QuickLogSheet } from "@/components/home/QuickLogSheet";
import { MoreMenuButton } from "@/components/home/MoreMenuButton";
import { HomeHeroBand } from "@/components/home/HomeHeroBand";
import { HomeDoorwayDials } from "@/components/home/HomeDoorwayDials";
import { MonthCalendarCard } from "@/components/home/MonthCalendarCard";
import { FuelRingCard } from "@/components/home/FuelRingCard";
import { TodaysPlanCard } from "@/components/home/TodaysPlanCard";
import { CoachBriefCard } from "@/components/home/CoachBriefCard";
import { WeekMapCard } from "@/components/home/WeekMapCard";
import { TrainingLoadCard } from "@/components/home/TrainingLoadCard";
import { RecentPRsCard } from "@/components/home/RecentPRsCard";
import { HabitsCard } from "@/components/home/HabitsCard";
import { GoalsCard } from "@/components/home/GoalsCard";
import { CalendarStripCard } from "@/components/home/CalendarStripCard";
import { OperatorCard } from "@/components/home/OperatorCard";
import { KeyTasksCard } from "@/components/home/KeyTasksCard";
import { StatCard } from "@/components/ui/StatCard";
import { seasonData } from "@/lib/data/season-data";
import { greetingForHour } from "@/lib/time";
import { withRetry } from "@/lib/db/withRetry";
import { withFallback } from "@/lib/db/withFallback";
import { getDailyBrief } from "@/lib/coach/dailyBrief";
import { getHomeViewModel, type HomeViewModel } from "./data";
import { CoachBriefSkeleton } from "./HomeSkeletons";

// CoachBriefSection takes the already-resolved view model as a prop instead
// of calling getHomeViewModel itself: this component's own async work (the
// dailyBrief fetch -- a live LLM call on the first request of the day) is
// what makes its Suspense boundary independently slow, and that's the only
// thing that should re-run per boundary. Re-fetching the view model here
// too would have meant every Suspense boundary re-running the full 19-query
// fetch against the 3-connection pool -- confirmed live (a debug counter
// showed 3 separate invocations, one per boundary) when this instead relied
// on React's cache() for request memoization; that turned out not to
// dedupe reliably across sibling/nested Suspense boundaries here, so a
// single real call site + prop-drilling replaces it as the actual guarantee.
async function CoachBriefSection({ today, vm }: { today: string; vm: HomeViewModel }) {
  const dailyBrief = await withFallback(
    withRetry(
      () =>
        getDailyBrief({
          today,
          athleteWeightKg: vm.latestWeighIn ? Number(vm.latestWeighIn.kg) : null,
          weightTrendKg: vm.weightTrend,
          kcalToday: vm.kcalToday,
          kcalTargetMin: vm.energyTarget.low,
          kcalTargetMax: vm.energyTarget.high,
          proteinToday: vm.proteinToday,
          proteinTargetMin: vm.proteinTarget.min,
          consistencyPct: vm.consistency.pct,
          todaySessionTitle: vm.todaySession?.title ?? null,
          todaySwim: vm.weekDay.swim ?? null,
          daysToNcaa: vm.daysToNcaa,
          daysToAsean: vm.settingsRow.aseanConfirmed === false ? null : vm.daysToAsean,
          trainingStatus: vm.settingsRow.trainingStatus,
          trainingStatusSince: vm.settingsRow.trainingStatusSince,
          phaseTag: vm.currentPhase.tag,
          phaseName: vm.currentPhase.name,
          loggedWorkoutToday: vm.loggedWorkoutToday,
          loggedSwimToday: vm.loggedSwimToday,
          recentSessionTypes: vm.recentSessionTypes,
          activeAlertHeadlines: vm.alerts.map((a) => a.title),
        }),
      { label: "Home daily brief" }
    ),
    null
  );

  return <CoachBriefCard brief={dailyBrief} bullets={vm.coachBriefBullets} followUps={vm.followUps} />;
}

// The one real call site for getHomeViewModel (data.ts) -- everything below
// this line, including the header's action buttons, shares this single
// fetch instead of each Suspense boundary re-triggering its own. dailyBrief
// is the one deliberate exception: CoachBriefSection above gets vm handed
// to it as a prop (already resolved by the time it renders) and only adds
// its own extra, genuinely-slower fetch on top -- so it can still stream in
// on its own schedule without ever re-running the 19-query fetch.
export async function HomeMainContent({ today }: { today: string }) {
  const vm = await getHomeViewModel(today);

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-title-3 font-semibold text-[var(--rtd-text)] md:hidden">Home</span>
        <div className="flex items-center gap-2 ml-auto">
          <QuickLogSheet
            lastNightSleep={vm.recentSleepLogs[0] ? { hours: Number(vm.recentSleepLogs[0].hours), bedtime: vm.recentSleepLogs[0].bedtime } : null}
            lastWeighInKg={vm.latestWeighIn ? Number(vm.latestWeighIn.kg) : null}
            phaseId={vm.todaySession ? vm.currentPhase.id : null}
            todayExercises={vm.todaySession?.exercises.map((e) => ({ id: e.id, name: e.name })) ?? []}
          />
          <div className="md:hidden">
            <MoreMenuButton trainingStatus={vm.settingsRow.trainingStatus} />
          </div>
        </div>
      </div>

      <AlertCardList alerts={vm.alerts} />

      <HomeHeroBand
        daysToNcaa={vm.daysToNcaa}
        ncaaDateLabel={vm.ncaaDateLabel}
        daysToSeaGames2027={vm.daysToSeaGames2027}
        seaGamesDateLabel={vm.seaGamesDateLabel}
        daysToPaiTryout={vm.daysToPaiTryout}
        daysToAsean={vm.daysToAsean}
        aseanLabel={vm.aseanLabel}
        aseanDateLabel={vm.aseanDateLabel}
        aseanConfirmed={vm.settingsRow.aseanConfirmed}
        seasonPct={vm.seasonPct}
        phaseTag={vm.currentPhase.tag}
        phaseName={vm.currentPhase.name}
        phaseWeek={vm.phaseWeek}
        readinessOverall={vm.readinessOverall}
        readinessSignals={vm.readinessSignals}
        actionLine={vm.readinessActionLineText}
      />
      <HomeDoorwayDials
        readinessOverall={vm.readinessOverall}
        greenSignalCount={vm.readinessSignals.filter((s) => s.light === "green").length}
        totalSignalCount={vm.readinessSignals.length}
        kcalToday={vm.kcalToday}
        kcalTargetMid={vm.energyTarget.kcal}
        consistencyPct={vm.consistency.pct}
      />

      {/* Miles OS Home grid (Personal OS merge, WS3/3d-7): the spec's
          7-panel mapping -- left rail Operator(01)/Training Load(07,
          repurposed from Finance Pulse)/Needs Attention(08, repurposed from
          Key Blockers); center Session(02)/Habits(03)/Calendar(04); right
          rail Nutrition(06) -- plus the retained extras (Goals, Key Tasks,
          Coach Brief, Month Calendar, Week Map, Recent PRs, bodyweight stat)
          folded into whichever column has room, replacing the old 12-col
          .rtd-home-grid entirely (WS3 section 7). Finance itself (KPI row,
          buckets, snapshot table) stays out of scope per the task brief. */}
      <div className="rtd-mos-grid">
        <div className="rtd-mos-col">
          <OperatorCard
            role={seasonData.meta.athlete}
            daysToDecember={vm.daysToNcaa}
            todaysFocus={vm.todaysFocus}
            consistencyPct={vm.consistency.pct}
            consistencyDone={vm.consistency.done}
            consistencyPlanned={vm.consistency.planned}
          />
          <TrainingLoadCard
            thisWeekDaily={vm.thisWeekDaily}
            lastWeekDaily={vm.lastWeekDaily}
            verdict={vm.trainingLoadVerdict}
            takeaway={vm.trainingLoadTakeaway}
          />
          <NeedsAttentionList items={vm.needsAttention} />
          <GoalsCard data={vm.goalsData} />
        </div>

        <div className="rtd-mos-col">
          <TodaysPlanCard
            rows={vm.planRows}
            startHref={vm.startHref}
            tomorrow={vm.tomorrowPreview}
            phaseId={vm.todaySession ? vm.currentPhase.id : null}
            todayExercises={vm.todaySession?.exercises.map((e) => ({ id: e.id, name: e.name })) ?? []}
            greeting={greetingForHour(vm.hour)}
          />
          {/* TEMP WS6 §2 Task 1: differential-diagnosis marker, embeds the exact
              server-rendered value of vm.habitsData.habits directly in the HTML
              response so it's inspectable without log-tailing. Remove after diagnosis. */}
          <div id="debug-1a-habits" style={{ display: "none" }}>
            {JSON.stringify({ count: vm.habitsData.habits.length, first: vm.habitsData.habits[0] ?? null })}
          </div>
          <HabitsCard habits={vm.habitsData.habits} dots={vm.habitStreakDots} today={today} />
          <CalendarStripCard days={vm.calendarStripDays} today={today} />
          <Suspense fallback={<CoachBriefSkeleton />}>
            <CoachBriefSection today={today} vm={vm} />
          </Suspense>
          <MonthCalendarCard
            today={today}
            gymDates={vm.recentWorkoutLogs.map((l) => l.date)}
            swimDates={vm.recentSwimSessions.map((s) => s.date)}
            className="hidden md:flex"
          />
        </div>

        <div className="rtd-mos-col">
          <FuelRingCard
            kcalToday={vm.kcalToday}
            kcalTargetMid={vm.energyTarget.kcal}
            proteinToday={vm.proteinToday}
            proteinTargetG={vm.proteinTarget.mid}
            carbsToday={vm.carbsToday}
            carbsTargetG={vm.carbsFatTarget.carbsG}
            fatToday={vm.fatToday}
            fatTargetG={vm.carbsFatTarget.fatG}
            waterMl={vm.waterToday}
            waterTargetMl={vm.settingsRow.waterTargetMl}
          />
          <KeyTasksCard tasks={vm.keyTasks} />

          <details className="lg:contents">
            <summary className="rtd-tap-target rtd-glass lg:hidden cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden rounded-[10px] px-3.5 py-2.5 flex items-center justify-between text-subhead font-medium text-[var(--rtd-text-secondary)]">
              More today
              <span aria-hidden="true" className="rtd-more-today-chevron">⌄</span>
            </summary>
            <div className="flex flex-col gap-2.5 mt-2.5 lg:contents">
              <WeekMapCard days={vm.weekMap.days} rows={vm.weekMap.rows} />
              <RecentPRsCard prs={vm.recentPRs} />
              <StatCard
                label="Bodyweight (7d)"
                numericValue={vm.latestWeighIn ? Number(vm.latestWeighIn.kg) : 0}
                decimals={1}
                suffix=" kg"
                domainColor="var(--rtd-cyan)"
                deltaPct={vm.weightTrendPct}
                goodDirection="up"
                sparklinePoints={vm.weightSeries.slice(-14).map((w) => Number(w.kg))}
              />
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
