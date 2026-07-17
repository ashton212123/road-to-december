CREATE TABLE "canvas_assignments" (
	"id" integer PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"name" text NOT NULL,
	"due_at" timestamp with time zone,
	"submitted" boolean DEFAULT false NOT NULL,
	"points_possible" numeric(6, 2),
	"score" numeric(6, 2),
	"html_url" text,
	"synced_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvas_courses" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"course_code" text,
	"current_grade" text,
	"synced_at" timestamp with time zone NOT NULL
);
