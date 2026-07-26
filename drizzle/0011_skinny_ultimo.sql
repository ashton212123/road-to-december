CREATE TABLE "session_loads" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"source_id" integer,
	"rpe" numeric(3, 1) NOT NULL,
	"duration_min" integer NOT NULL,
	"load" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meets" ADD COLUMN "course" text;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "energy_phase" text DEFAULT 'gain' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "kcal_target_override" integer;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "pool_course_default" text DEFAULT 'SCM' NOT NULL;--> statement-breakpoint
ALTER TABLE "swim_sessions" ADD COLUMN "course" text;--> statement-breakpoint
ALTER TABLE "swim_sessions" ADD COLUMN "session_type" text;--> statement-breakpoint
ALTER TABLE "swim_sessions" ADD COLUMN "zone_distance_m" jsonb;--> statement-breakpoint
ALTER TABLE "swim_sessions" ADD COLUMN "stroke_distance_m" jsonb;--> statement-breakpoint
ALTER TABLE "swim_sessions" ADD COLUMN "stated_total_distance_m" integer;--> statement-breakpoint
ALTER TABLE "swim_sessions" ADD COLUMN "breast_kick_m" integer;--> statement-breakpoint
ALTER TABLE "swim_sessions" ADD COLUMN "duration_min" integer;--> statement-breakpoint
ALTER TABLE "swim_sessions" ADD COLUMN "session_rpe" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "swim_sessions" ADD COLUMN "ai_summary" text;--> statement-breakpoint
ALTER TABLE "swim_sessions" ADD COLUMN "ai_analysis" text;--> statement-breakpoint
ALTER TABLE "swim_times" ADD COLUMN "course" text;--> statement-breakpoint
ALTER TABLE "swim_times" ADD COLUMN "stroke_rates" jsonb;--> statement-breakpoint
ALTER TABLE "swim_times" ADD COLUMN "notes" text;--> statement-breakpoint
CREATE UNIQUE INDEX "session_loads_date_kind_source_idx" ON "session_loads" USING btree ("date","kind","source_id");