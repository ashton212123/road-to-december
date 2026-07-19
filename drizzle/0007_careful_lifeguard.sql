CREATE TABLE "knowledge" (
	"path" text PRIMARY KEY NOT NULL,
	"folder" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"modified_at" timestamp with time zone NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
