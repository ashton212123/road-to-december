CREATE TABLE "learn_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"track_id" text NOT NULL,
	"level_key" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "learn_progress_track_level_idx" ON "learn_progress" USING btree ("track_id","level_key");