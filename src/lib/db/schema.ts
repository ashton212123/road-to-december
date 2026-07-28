import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  real,
  boolean,
  date,
  timestamp,
  jsonb,
  vector,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

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
    // Learned/seeded working weight -- the checkbox-complete default. Starts
    // null (no fake weight ever fabricated); backfilled from history where it
    // exists, then kept current by progression suggestions over time.
    defaultWeightKg: numeric("default_weight_kg", { precision: 6, scale: 2 }),
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
  course: text("course").$type<"SCM" | "LCM">(),
  strokeRates: jsonb("stroke_rates").$type<number[]>(),
  notes: text("notes"),
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
  // Gentler Streak-style status flag (V4 P3): while non-"healthy", missed
  // sessions are excused everywhere (week map, consistency %, readiness,
  // coach brief tone) instead of penalized. trainingStatusSince is null
  // exactly when status is "healthy".
  trainingStatus: text("training_status").notNull().default("healthy").$type<"healthy" | "sick" | "injured" | "break">(),
  trainingStatusSince: date("training_status_since"),
  // null = auto-follow the season calendar (computeAutoEnergyPhase, loop 38);
  // non-null = an explicit override the athlete/coach set in Settings.
  energyPhase: text("energy_phase").$type<"gain" | "maintain" | "sharpen">(),
  kcalTargetOverride: integer("kcal_target_override"),
  poolCourseDefault: text("pool_course_default").notNull().default("SCM").$type<"SCM" | "LCM">(),
});

// ---------- Business tracker ----------

export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessTransactions = pgTable("business_transactions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'income' | 'expense'
  amountPhp: numeric("amount_php", { precision: 12, scale: 2 }).notNull(),
  description: text("description").notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessTasks = pgTable("business_tasks", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  done: boolean("done").notNull().default(false),
  dueDate: date("due_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const businessNotes = pgTable("business_notes", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Canvas LMS cache ----------
// Mirrors Canvas's own ids (not serial) — the sync job fully replaces these
// rows from the live API, so local edits are never expected.

export const canvasCourses = pgTable("canvas_courses", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  courseCode: text("course_code"),
  currentGrade: text("current_grade"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
});

export const canvasAssignments = pgTable("canvas_assignments", {
  id: integer("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  name: text("name").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  submitted: boolean("submitted").notNull().default(false),
  pointsPossible: numeric("points_possible", { precision: 6, scale: 2 }),
  score: numeric("score", { precision: 6, scale: 2 }),
  htmlUrl: text("html_url"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull(),
});

// ---------- Meets & target-time readiness ----------

export const meets = pgTable("meets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  date: date("date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  course: text("course").$type<"SCM" | "LCM">(),
});

export const meetEvents = pgTable("meet_events", {
  id: serial("id").primaryKey(),
  meetId: integer("meet_id")
    .notNull()
    .references(() => meets.id, { onDelete: "cascade" }),
  event: text("event").notNull(),
  currentTimeMs: integer("current_time_ms"),
  targetTimeMs: integer("target_time_ms").notNull(),
});

// ---------- Swim training sessions (daily load, distinct from race-pace swim_times) ----------

export type SwimSessionInterval = {
  reps: number;
  distanceM: number;
  stroke: string;
  targetInterval?: string; // e.g. "1:10"
  avgTime?: string; // e.g. "38s" -- per-rep average, not the interval clock
  note?: string; // e.g. "W/U", "W/D", "drill"
  // Phase-6 additions -- optional so existing stored intervals still typecheck.
  zone?: string; // Zone from lib/swim/zones.ts
  isKick?: boolean;
  isPull?: boolean;
  isDrill?: boolean;
};

export const swimSessions = pgTable("swim_sessions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  loadRating: integer("load_rating").notNull(), // 1-10 subjective session load (RPE-style)
  setsText: text("sets_text"), // free-text description, e.g. "10x100 BR @1:30, main set 6x200 IM"
  parsedDistanceM: integer("parsed_distance_m"), // best-effort total distance parsed from setsText
  // Structured interval breakdown from the V4 P4 AI session-import flow.
  // Null for sessions logged the old way (manual load+text) -- never
  // backfilled/fabricated, so the pace-per-100 trend only ever plots real
  // parsed data.
  intervals: jsonb("intervals").$type<SwimSessionInterval[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  course: text("course").$type<"SCM" | "LCM">(),
  sessionType: text("session_type"),
  zoneDistanceM: jsonb("zone_distance_m").$type<Record<string, number>>(),
  strokeDistanceM: jsonb("stroke_distance_m").$type<Record<string, number>>(),
  statedTotalDistanceM: integer("stated_total_distance_m"),
  breastKickM: integer("breast_kick_m"),
  durationMin: integer("duration_min"),
  sessionRpe: numeric("session_rpe", { precision: 3, scale: 1 }),
  aiSummary: text("ai_summary"),
  aiAnalysis: text("ai_analysis"),
});

// Unified session-load store for both swim and gym -- the sRPE (rpe x
// duration) that drives ACWR/weekly-load everywhere, so gym-only load
// monitoring stops being ~75% blind to a 9-swims-a-week athlete.
export const sessionLoads = pgTable(
  "session_loads",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    kind: text("kind").notNull().$type<"gym" | "swim">(),
    sourceId: integer("source_id"), // swim_sessions.id when kind='swim'; null for gym
    rpe: numeric("rpe", { precision: 3, scale: 1 }).notNull(),
    durationMin: integer("duration_min").notNull(),
    load: integer("load").notNull(), // rpe x durationMin, stored so it never re-derives differently
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("session_loads_date_kind_source_idx").on(table.date, table.kind, table.sourceId)]
);

// One AI-generated coach-voiced brief per day, generated on first Home load
// and cached here so it never regenerates mid-day and never costs a second
// Groq call.
export const dailyBriefs = pgTable("daily_briefs", {
  date: date("date").primaryKey(),
  message: text("message").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Generic per-day cache for AI-generated one-liners keyed by a feature name
// (currently just "strength-plateau") so a page never re-costs a Groq call
// on every load, and future AI takeaways reuse the same table.
export const aiTakeaways = pgTable(
  "ai_takeaways",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    key: text("key").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ai_takeaways_date_key_idx").on(table.date, table.key)]
);

// Completion tracking for the Learn tab. Content (tracks/levels) lives as
// static data in lib/data/learn-tracks.ts, not the DB -- this table only
// records which level keys are done. trackId/levelKey are the static data's
// own ids (e.g. "python-30-days" / "day-05"), never a foreign key.
export const learnProgress = pgTable(
  "learn_progress",
  {
    id: serial("id").primaryKey(),
    trackId: text("track_id").notNull(),
    levelKey: text("level_key").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("learn_progress_track_level_idx").on(table.trackId, table.levelKey)]
);

export const coachMessages = pgTable("coach_messages", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(), // 'user' | 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Synced copy of an explicit include-list of Obsidian vault folders, pushed
// by the local `npm run sync:vault` script (the server can't reach the
// user's filesystem). One row per note -- the vault is small enough that
// whole-file storage plus keyword/recency retrieval is the right scale here,
// no embeddings infra needed.
export const knowledge = pgTable("knowledge", {
  path: text("path").primaryKey(), // vault-relative path, e.g. "01 Projects/Road to December.md"
  folder: text("folder").notNull(), // top-level included folder, e.g. "01 Projects"
  title: text("title").notNull(),
  content: text("content").notNull(),
  modifiedAt: timestamp("modified_at", { withTimezone: true }).notNull(),
  syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Personal OS: capture pipeline, tasks, habits, goals, memory ----------
// Merge-build additions (PERSONAL_OS_MERGE_PROMPT.md Phase 1). No user_id
// columns -- this stays a single-user app, same as everything above.

// Every voice/text note that comes in over Telegram/web/iOS, before and
// after classification -- kept forever (even on failure) so raw input is
// never lost. status starts 'pending', moves to 'routed'/'failed'/'discarded'.
export const rawCaptures = pgTable(
  "raw_captures",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull().$type<"telegram" | "web" | "ios">(),
    telegramUpdateId: integer("telegram_update_id"),
    rawText: text("raw_text"),
    transcript: text("transcript"),
    audioFileId: text("audio_file_id"),
    classification: jsonb("classification"),
    model: text("model"),
    routedTo: text("routed_to").array(),
    routedIds: jsonb("routed_ids"),
    status: text("status").notNull().default("pending").$type<"pending" | "routed" | "failed" | "discarded">(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("raw_captures_telegram_update_id_idx").on(table.telegramUpdateId)]
);

// The universal task layer (CRM, Phase 3). Manual rows are created directly;
// mirrored rows (sourceKind 'business'/'canvas') are read-only copies of
// businessTasks/canvasAssignments, kept in sync by src/lib/crm/mirror.ts --
// the partial unique index only applies to those, so manual tasks (sourceId
// always null) are never constrained by it.
export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    notes: text("notes"),
    urgency: text("urgency").notNull().$type<"today" | "week" | "month" | "someday">(),
    isKey: boolean("is_key").notNull().default(false),
    priorityScore: real("priority_score").notNull().default(0),
    timeEstimateMin: integer("time_estimate_min"),
    tags: text("tags").array(),
    dueDate: date("due_date"),
    rail: text("rail").notNull().$type<"life" | "athlete">(),
    category: text("category"),
    sourceKind: text("source_kind").notNull().default("manual").$type<"manual" | "capture" | "business" | "canvas">(),
    sourceId: text("source_id"),
    captureId: integer("capture_id").references(() => rawCaptures.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("tasks_source_kind_source_id_idx")
      .on(table.sourceKind, table.sourceId)
      .where(sql`${table.sourceKind} <> 'manual'`),
  ]
);

// Seeded with swimmer defaults (Phase 4), fully editable afterwards.
export const habits = pgTable("habits", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  sortOrder: integer("sort_order").notNull(),
  subtasks: jsonb("subtasks").$type<{ id: string; label: string }[]>(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per habit per day it was touched. logDate always uses
// todayManilaISO() (src/lib/time.ts) -- never the server clock or UTC.
export const habitLogs = pgTable(
  "habit_logs",
  {
    id: serial("id").primaryKey(),
    habitId: integer("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    logDate: date("log_date").notNull(),
    doneSubtaskIds: text("done_subtask_ids").array(),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("habit_logs_habit_date_idx").on(table.habitId, table.logDate)]
);

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  entryDate: date("entry_date").notNull(),
  rawText: text("raw_text"),
  transcript: text("transcript"),
  summary: text("summary"),
  mood: integer("mood"),
  tags: text("tags").array(),
  source: text("source").notNull().$type<"telegram" | "web">(),
  captureId: integer("capture_id").references(() => rawCaptures.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Persistent week/month lists -- a real table, not the cheat sheet's
// sentinel-date hack (Decision 10). Nothing auto-clears.
export const goals = pgTable("goals", {
  id: serial("id").primaryKey(),
  scope: text("scope").notNull().$type<"week" | "month">(),
  text: text("text").notNull(),
  done: boolean("done").notNull().default(false),
  sortOrder: integer("sort_order").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// The Brain's vector store (Phase 6). One canonical-sentence chunk per
// source row, upserted on (sourceType, sourceId) so a re-embed (e.g. an
// edited log) replaces rather than duplicates. HNSW over ivfflat -- needs no
// training pass, which matters because this table starts empty.
export const memoryChunks = pgTable(
  "memory_chunks",
  {
    id: serial("id").primaryKey(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id").notNull(),
    sourceDate: date("source_date"),
    text: text("text").notNull(),
    embedding: vector("embedding", { dimensions: 768 }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("memory_chunks_source_idx").on(table.sourceType, table.sourceId),
    index("memory_chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ]
);

// Append-only record of writes the capture pipeline (and later, CRM/habit
// mutations) makes -- not exposed in any UI yet, just a durable trail.
export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
export type Business = typeof businesses.$inferSelect;
export type BusinessTransaction = typeof businessTransactions.$inferSelect;
export type BusinessTask = typeof businessTasks.$inferSelect;
export type BusinessNote = typeof businessNotes.$inferSelect;
export type CanvasCourse = typeof canvasCourses.$inferSelect;
export type CanvasAssignment = typeof canvasAssignments.$inferSelect;
export type Meet = typeof meets.$inferSelect;
export type MeetEvent = typeof meetEvents.$inferSelect;
export type SwimSession = typeof swimSessions.$inferSelect;
export type SessionLoad = typeof sessionLoads.$inferSelect;
export type DailyBrief = typeof dailyBriefs.$inferSelect;
export type CoachMessage = typeof coachMessages.$inferSelect;
export type KnowledgeNote = typeof knowledge.$inferSelect;
export type RawCapture = typeof rawCaptures.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type MemoryChunk = typeof memoryChunks.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
