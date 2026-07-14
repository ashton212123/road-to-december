import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------- Program data (seeded, read-mostly) ----------

export const phases = pgTable("phases", {
  id: text("id").primaryKey(), // 'p1'..'p6'
  tag: text("tag").notNull(), // 'P1'..'P6'
  name: text("name").notNull(),
  weeks: text("weeks").notNull(), // 'Wk 1–2'
  dates: text("dates").notNull(), // 'Jul 6–19'
  color: text("color").notNull(),
  blurb: text("blurb").notNull(),
  note: text("note"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  isDeload: boolean("is_deload").notNull().default(false),
  deloadWeek: integer("deload_week"),
  isRaceBlock: boolean("is_race_block").notNull().default(false),
  waveScheme: jsonb("wave_scheme").$type<
    { sets: number; reps: number; pctMin: number; pctMax: number }[]
  >(),
  blocks: jsonb("blocks").$type<
    { id: string; title: string; condition: string; body: string }[]
  >(),
  orderIndex: integer("order_index").notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    phaseId: text("phase_id")
      .notNull()
      .references(() => phases.id, { onDelete: "cascade" }),
    dayKey: text("day_key").notNull(), // 'tue' | 'thu' | 'sun'
    title: text("title").notNull(),
    orderIndex: integer("order_index").notNull(),
  },
  (table) => [uniqueIndex("sessions_phase_day_idx").on(table.phaseId, table.dayKey)]
);

export const exercises = pgTable(
  "exercises",
  {
    id: serial("id").primaryKey(),
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prescription: text("prescription").notNull().default(""), // raw string, e.g. "4×6 @ 70–75%"
    targetSets: integer("target_sets"),
    targetRepsMin: integer("target_reps_min"),
    targetRepsMax: integer("target_reps_max"),
    pct1rmMin: numeric("pct_1rm_min", { precision: 5, scale: 2 }),
    pct1rmMax: numeric("pct_1rm_max", { precision: 5, scale: 2 }),
    rpeMin: numeric("rpe_min", { precision: 4, scale: 2 }),
    rpeMax: numeric("rpe_max", { precision: 4, scale: 2 }),
    restSecondsPrescribed: integer("rest_seconds_prescribed"),
    isExplosive: boolean("is_explosive").notNull().default(false),
    isMainLift: boolean("is_main_lift").notNull().default(false),
    isMonitor: boolean("is_monitor").notNull().default(false),
    movementPattern: text("movement_pattern"), // 'squat' | 'hinge' | 'press' | 'pull' | null
    orderIndex: integer("order_index").notNull(),
  },
  (table) => [uniqueIndex("exercises_session_order_idx").on(table.sessionId, table.orderIndex)]
);

// ---------- User-logged data ----------

export const workoutLogs = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  setNumber: integer("set_number").notNull(),
  weightKg: numeric("weight_kg", { precision: 6, scale: 2 }),
  reps: integer("reps"),
  rpe: numeric("rpe", { precision: 4, scale: 2 }),
  restSeconds: integer("rest_seconds"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weighIns = pgTable(
  "weigh_ins",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    kg: numeric("kg", { precision: 5, scale: 2 }).notNull(),
  },
  (table) => [uniqueIndex("weigh_ins_date_idx").on(table.date)]
);

export const cmjTests = pgTable("cmj_tests", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  bestOf3Cm: numeric("best_of_3_cm", { precision: 5, scale: 2 }).notNull(),
});

export const jumpTests = pgTable("jump_tests", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  type: text("type").notNull(), // 'broad_jump' | 'seated_box'
  valueCm: numeric("value_cm", { precision: 6, scale: 2 }).notNull(),
});

export const swimTimes = pgTable("swim_times", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  event: text("event").notNull(), // '50 Breast' | '100 Breast' | '200 Breast' | '200 IM' | '400 IM'
  timeMs: integer("time_ms").notNull(),
  meetName: text("meet_name"),
  splits: jsonb("splits").$type<number[]>(),
  strokeCounts: jsonb("stroke_counts").$type<number[]>(),
  isPb: boolean("is_pb").notNull().default(false),
});

export const timeTo15m = pgTable("time_to_15m", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  seconds: numeric("seconds", { precision: 5, scale: 2 }).notNull(),
  condition: text("condition").notNull(), // 'fresh' | 'fatigued'
});

export const foodLogs = pgTable("food_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  timeSlot: text("time_slot").notNull(),
  description: text("description").notNull(),
  kcal: integer("kcal").notNull(),
  proteinG: numeric("protein_g", { precision: 6, scale: 1 }).notNull(),
  carbsG: numeric("carbs_g", { precision: 6, scale: 1 }),
  fatG: numeric("fat_g", { precision: 6, scale: 1 }),
  source: text("source").notNull().default("manual"), // 'quick' | 'manual' | 'ai'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const waterLogs = pgTable("water_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  ml: integer("ml").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sleepLogs = pgTable("sleep_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  hours: numeric("hours", { precision: 4, scale: 2 }).notNull(),
  bedtime: text("bedtime"), // 'HH:MM'
  onTime: boolean("on_time"), // Tue/Thu 9:30 PM rule
});

export const sorenessLogs = pgTable("soreness_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  rating1to5: integer("rating_1_5").notNull(),
  area: text("area").notNull(),
});

export const settings = pgTable("settings", {
  id: text("id").primaryKey().default("singleton"),
  aseanConfirmed: boolean("asean_confirmed"), // null = unknown, true = confirmed, false = cancelled
  waterTargetMl: integer("water_target_ml").notNull().default(3000),
  weightUnit: text("weight_unit").notNull().default("kg"), // 'kg' | 'lb'
});

export type Phase = typeof phases.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type WeighIn = typeof weighIns.$inferSelect;
export type CmjTest = typeof cmjTests.$inferSelect;
export type JumpTest = typeof jumpTests.$inferSelect;
export type SwimTime = typeof swimTimes.$inferSelect;
export type TimeTo15m = typeof timeTo15m.$inferSelect;
export type FoodLog = typeof foodLogs.$inferSelect;
export type WaterLog = typeof waterLogs.$inferSelect;
export type SleepLog = typeof sleepLogs.$inferSelect;
export type SorenessLog = typeof sorenessLogs.$inferSelect;
export type Settings = typeof settings.$inferSelect;
