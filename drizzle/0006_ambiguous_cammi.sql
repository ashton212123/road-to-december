CREATE TABLE "ai_takeaways" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"key" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ai_takeaways_date_key_idx" ON "ai_takeaways" USING btree ("date","key");