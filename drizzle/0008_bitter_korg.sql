ALTER TABLE "settings" ADD COLUMN "training_status" text DEFAULT 'healthy' NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "training_status_since" date;