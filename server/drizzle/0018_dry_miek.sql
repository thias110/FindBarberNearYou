ALTER TYPE "public"."audit_action" ADD VALUE 'USER_DELETED';--> statement-breakpoint
ALTER TYPE "public"."user_status" ADD VALUE 'DELETED';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;