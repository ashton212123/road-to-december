CREATE TABLE "meet_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"meet_id" integer NOT NULL,
	"event" text NOT NULL,
	"current_time_ms" integer,
	"target_time_ms" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swim_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"load_rating" integer NOT NULL,
	"sets_text" text,
	"parsed_distance_m" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meet_events" ADD CONSTRAINT "meet_events_meet_id_meets_id_fk" FOREIGN KEY ("meet_id") REFERENCES "public"."meets"("id") ON DELETE cascade ON UPDATE no action;