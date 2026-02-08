CREATE TYPE "public"."connection_status" AS ENUM('connected', 'disconnected', 'connecting', 'error');--> statement-breakpoint
CREATE TYPE "public"."device_platform" AS ENUM('desktop', 'android', 'ios', 'web');--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"platform" "device_platform" NOT NULL,
	"status" "connection_status" DEFAULT 'disconnected' NOT NULL,
	"metadata" jsonb,
	"last_seen_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "devices_user_id_idx" ON "devices" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "devices_status_idx" ON "devices" USING btree ("status");