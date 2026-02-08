CREATE TYPE "public"."automation_status" AS ENUM('active', 'paused', 'disabled', 'error');--> statement-breakpoint
CREATE TYPE "public"."mission_status" AS ENUM('planning', 'executing', 'awaiting_approval', 'paused', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('pending', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."trigger_type" AS ENUM('cron', 'event', 'webhook', 'manual');--> statement-breakpoint
CREATE TABLE "automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "automation_status" DEFAULT 'active' NOT NULL,
	"trigger_type" "trigger_type" NOT NULL,
	"trigger_config" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	"last_run_at" timestamp,
	"last_run_status" "run_status",
	"run_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "missions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"goal" text NOT NULL,
	"status" "mission_status" DEFAULT 'planning' NOT NULL,
	"plan" jsonb,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_step_id" text,
	"approval_settings" jsonb,
	"error" text,
	"metadata" jsonb,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "automations_user_id_idx" ON "automations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "automations_status_idx" ON "automations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "automations_created_at_idx" ON "automations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "missions_user_id_idx" ON "missions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "missions_status_idx" ON "missions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "missions_created_at_idx" ON "missions" USING btree ("created_at");