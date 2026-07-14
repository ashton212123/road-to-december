CREATE TABLE "cmj_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"best_of_3_cm" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exercises" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"name" text NOT NULL,
	"prescription" text DEFAULT '' NOT NULL,
	"target_sets" integer,
	"target_reps_min" integer,
	"target_reps_max" integer,
	"pct_1rm_min" numeric(5, 2),
	"pct_1rm_max" numeric(5, 2),
	"rpe_min" numeric(4, 2),
	"rpe_max" numeric(4, 2),
	"rest_seconds_prescribed" integer,
	"is_explosive" boolean DEFAULT false NOT NULL,
	"is_main_lift" boolean DEFAULT false NOT NULL,
	"is_monitor" boolean DEFAULT false NOT NULL,
	"movement_pattern" text,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"time_slot" text NOT NULL,
	"description" text NOT NULL,
	"kcal" integer NOT NULL,
	"protein_g" numeric(6, 1) NOT NULL,
	"carbs_g" numeric(6, 1),
	"fat_g" numeric(6, 1),
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jump_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"type" text NOT NULL,
	"value_cm" numeric(6, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phases" (
	"id" text PRIMARY KEY NOT NULL,
	"tag" text NOT NULL,
	"name" text NOT NULL,
	"weeks" text NOT NULL,
	"dates" text NOT NULL,
	"color" text NOT NULL,
	"blurb" text NOT NULL,
	"note" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_deload" boolean DEFAULT false NOT NULL,
	"deload_week" integer,
	"is_race_block" boolean DEFAULT false NOT NULL,
	"wave_scheme" jsonb,
	"blocks" jsonb,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"phase_id" text NOT NULL,
	"day_key" text NOT NULL,
	"title" text NOT NULL,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"asean_confirmed" boolean,
	"water_target_ml" integer DEFAULT 3000 NOT NULL,
	"weight_unit" text DEFAULT 'kg' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sleep_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"hours" numeric(4, 2) NOT NULL,
	"bedtime" text,
	"on_time" boolean
);
--> statement-breakpoint
CREATE TABLE "soreness_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"rating_1_5" integer NOT NULL,
	"area" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swim_times" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"event" text NOT NULL,
	"time_ms" integer NOT NULL,
	"meet_name" text,
	"splits" jsonb,
	"stroke_counts" jsonb,
	"is_pb" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "time_to_15m" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"seconds" numeric(5, 2) NOT NULL,
	"condition" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "water_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"ml" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weigh_ins" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"kg" numeric(5, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"exercise_id" integer NOT NULL,
	"set_number" integer NOT NULL,
	"weight_kg" numeric(6, 2),
	"reps" integer,
	"rpe" numeric(4, 2),
	"rest_seconds" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_phase_id_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_logs" ADD CONSTRAINT "workout_logs_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_session_order_idx" ON "exercises" USING btree ("session_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_phase_day_idx" ON "sessions" USING btree ("phase_id","day_key");--> statement-breakpoint
CREATE UNIQUE INDEX "weigh_ins_date_idx" ON "weigh_ins" USING btree ("date");