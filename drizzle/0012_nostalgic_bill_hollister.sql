CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"text" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "habit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"habit_id" integer NOT NULL,
	"log_date" date NOT NULL,
	"done_subtask_ids" text[],
	"completed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"sort_order" integer NOT NULL,
	"subtasks" jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_date" date NOT NULL,
	"raw_text" text,
	"transcript" text,
	"summary" text,
	"mood" integer,
	"tags" text[],
	"source" text NOT NULL,
	"capture_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"source_date" date,
	"text" text NOT NULL,
	"embedding" vector(768),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_captures" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"telegram_update_id" integer,
	"raw_text" text,
	"transcript" text,
	"audio_file_id" text,
	"classification" jsonb,
	"model" text,
	"routed_to" text[],
	"routed_ids" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"urgency" text NOT NULL,
	"is_key" boolean DEFAULT false NOT NULL,
	"priority_score" real DEFAULT 0 NOT NULL,
	"time_estimate_min" integer,
	"tags" text[],
	"due_date" date,
	"rail" text NOT NULL,
	"category" text,
	"source_kind" text DEFAULT 'manual' NOT NULL,
	"source_id" text,
	"capture_id" integer,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "energy_phase" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "settings" ALTER COLUMN "energy_phase" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_habit_id_habits_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_capture_id_raw_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."raw_captures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_capture_id_raw_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."raw_captures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "habit_logs_habit_date_idx" ON "habit_logs" USING btree ("habit_id","log_date");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_chunks_source_idx" ON "memory_chunks" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "memory_chunks_embedding_idx" ON "memory_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "raw_captures_telegram_update_id_idx" ON "raw_captures" USING btree ("telegram_update_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_source_kind_source_id_idx" ON "tasks" USING btree ("source_kind","source_id") WHERE "tasks"."source_kind" <> 'manual';