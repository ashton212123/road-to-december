import { sql } from "drizzle-orm";
import { db } from "./index";
import type {
  WorkoutLog,
  WeighIn,
  CmjTest,
  JumpTest,
  SwimTime,
  TimeTo15m,
  FoodLog,
  SleepLog,
  SorenessLog,
  WaterLog,
  SwimSession,
  SessionLoad,
  Settings,
} from "./schema";

export type AnalyticsWorkoutLogWithExercise = Pick<WorkoutLog, "id" | "date" | "setNumber" | "weightKg" | "reps" | "rpe" | "createdAt"> & {
  exerciseId: number;
  exerciseName: string;
  movementPattern: string | null;
  isMainLift: boolean;
};

export type AnalyticsMeetWithEvents = {
  id: number;
  name: string;
  date: string;
  course: "SCM" | "LCM" | null;
  events: { id: number; event: string; currentTimeMs: number | null; targetTimeMs: number }[];
};

export type AnalyticsPageData = {
  mainLiftLogs: AnalyticsWorkoutLogWithExercise[];
  weighIns: WeighIn[];
  cmjTests: CmjTest[];
  jumpTestsRaw: JumpTest[]; // unfiltered by type, matching getJumpTests' own top-N-then-filter behavior
  swimTimes: SwimTime[];
  timeTo15m: TimeTo15m[];
  meetsWithEvents: AnalyticsMeetWithEvents[];
  swimSessions: SwimSession[];
  sessionLoads: SessionLoad[];
  foodLogs: FoodLog[];
  sleepLogs: SleepLog[];
  sorenessLogs: SorenessLog[];
  waterLogs: WaterLog[];
  settingsRow: Settings | null;
};

/**
 * Everything the Analytics page needs, in ONE round trip instead of 13
 * parallel queries fighting over the connection pool. One SELECT with a
 * json_agg subquery per dataset, matching each replaced query's exact
 * filter/order/limit. Numeric columns are cast to text so the shape matches
 * Drizzle's own numeric-as-string convention exactly -- every downstream
 * `Number(...)` call in analytics/page.tsx is untouched.
 */
export async function getAnalyticsPageDataRaw(sinceISO: string): Promise<AnalyticsPageData> {
  const rows = await db.execute(sql`
    select
      (select coalesce(json_agg(t), '[]') from (
        select
          wl.id, wl.date, wl.set_number as "setNumber", wl.weight_kg::text as "weightKg",
          wl.reps, wl.rpe::text as "rpe", wl.created_at as "createdAt",
          e.id as "exerciseId", e.name as "exerciseName",
          e.movement_pattern as "movementPattern", e.is_main_lift as "isMainLift"
        from workout_logs wl
        join exercises e on e.id = wl.exercise_id
        where wl.date >= ${sinceISO}
        order by wl.date asc
      ) t) as "mainLiftLogs",

      (select coalesce(json_agg(t), '[]') from (
        select id, date, kg::text as kg from weigh_ins order by date desc limit 180
      ) t) as "weighIns",

      (select coalesce(json_agg(t), '[]') from (
        select id, date, best_of_3_cm::text as "bestOf3Cm" from cmj_tests order by date desc limit 30
      ) t) as "cmjTests",

      (select coalesce(json_agg(t), '[]') from (
        select id, date, type, value_cm::text as "valueCm" from jump_tests order by date desc limit 30
      ) t) as "jumpTestsRaw",

      (select coalesce(json_agg(t), '[]') from (
        select id, date, event, time_ms as "timeMs", meet_name as "meetName", splits, stroke_counts as "strokeCounts", is_pb as "isPb",
               course, stroke_rates as "strokeRates", notes
        from swim_times order by date desc limit 200
      ) t) as "swimTimes",

      (select coalesce(json_agg(t), '[]') from (
        select id, date, seconds::text as seconds, condition from time_to_15m order by date desc limit 50
      ) t) as "timeTo15m",

      (select coalesce(json_agg(t), '[]') from (
        select
          m.id, m.name, m.date, m.course,
          coalesce((
            select json_agg(json_build_object(
              'id', me.id, 'event', me.event, 'currentTimeMs', me.current_time_ms, 'targetTimeMs', me.target_time_ms
            ))
            from meet_events me where me.meet_id = m.id
          ), '[]') as events
        from meets m order by m.date asc
      ) t) as "meetsWithEvents",

      (select coalesce(json_agg(t), '[]') from (
        select id, date, load_rating as "loadRating", sets_text as "setsText", parsed_distance_m as "parsedDistanceM",
               intervals, created_at as "createdAt", course, session_type as "sessionType",
               zone_distance_m as "zoneDistanceM", stroke_distance_m as "strokeDistanceM",
               stated_total_distance_m as "statedTotalDistanceM", breast_kick_m as "breastKickM",
               duration_min as "durationMin", session_rpe::text as "sessionRpe"
        from swim_sessions order by date desc limit 60
      ) t) as "swimSessions",

      (select coalesce(json_agg(t), '[]') from (
        select id, date, kind, source_id as "sourceId", rpe::text as "rpe", duration_min as "durationMin",
               load, created_at as "createdAt"
        from session_loads where date >= ${sinceISO} order by date desc
      ) t) as "sessionLoads",

      (select coalesce(json_agg(t), '[]') from (
        select id, date, time_slot as "timeSlot", description, kcal, protein_g::text as "proteinG",
               carbs_g::text as "carbsG", fat_g::text as "fatG", source, created_at as "createdAt"
        from food_logs where date >= ${sinceISO} order by date desc
      ) t) as "foodLogs",

      (select coalesce(json_agg(t), '[]') from (
        select id, date, hours::text as hours, bedtime, on_time as "onTime" from sleep_logs order by date desc limit 180
      ) t) as "sleepLogs",

      (select coalesce(json_agg(t), '[]') from (
        select id, date, rating_1_5 as "rating1to5", area from soreness_logs order by date desc limit 30
      ) t) as "sorenessLogs",

      (select coalesce(json_agg(t), '[]') from (
        select id, date, ml, created_at as "createdAt" from water_logs where date >= ${sinceISO} order by date desc
      ) t) as "waterLogs",

      (select row_to_json(t) from (
        select id, asean_confirmed as "aseanConfirmed", water_target_ml as "waterTargetMl", weight_unit as "weightUnit",
               training_status as "trainingStatus", training_status_since as "trainingStatusSince",
               kcal_target_override as "kcalTargetOverride", energy_phase as "energyPhase"
        from settings where id = 'singleton'
      ) t) as "settingsRow"
  `);

  return rows[0] as unknown as AnalyticsPageData;
}
