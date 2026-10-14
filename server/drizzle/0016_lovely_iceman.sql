CREATE TYPE "public"."audit_action" AS ENUM('BOOKING_CONFIRMED', 'BOOKING_DECLINED', 'BOOKING_COMPLETED', 'BOOKING_CANCELLED', 'BOOKING_EXPIRED', 'USER_SUSPENDED', 'USER_REACTIVATED', 'REVIEW_HIDDEN');--> statement-breakpoint
CREATE TYPE "public"."audit_target_type" AS ENUM('BOOKING', 'USER', 'REVIEW');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_role" "user_role",
	"action" "audit_action" NOT NULL,
	"target_type" "audit_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_target_idx" ON "audit_logs" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_created_idx" ON "audit_logs" USING btree ("action","created_at");