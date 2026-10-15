ALTER TYPE "public"."audit_action" ADD VALUE 'BARBER_APPROVED';--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
-- Reprise (issue #40) : les profils existants avant la fonctionnalité sont
-- considérés comme approuvés et restent visibles.
UPDATE "barber_profiles" SET "approved_at" = "created_at" WHERE "approved_at" IS NULL;