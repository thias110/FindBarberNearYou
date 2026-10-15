ALTER TYPE "public"."audit_action" ADD VALUE 'BARBER_CERTIFIED';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE 'BARBER_UNCERTIFIED';--> statement-breakpoint
ALTER TYPE "public"."audit_target_type" ADD VALUE 'BARBER_PROFILE';--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD COLUMN "certified_at" timestamp with time zone;