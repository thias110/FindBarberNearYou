ALTER TYPE "public"."booking_status" ADD VALUE 'DECLINED';--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'EXPIRED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'BOOKING_DECLINED';--> statement-breakpoint
ALTER TYPE "public"."notification_type" ADD VALUE 'BOOKING_EXPIRED';--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "declined_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "decline_reason" text;--> statement-breakpoint
CREATE INDEX "bookings_status_created_idx" ON "bookings" USING btree ("status","created_at");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_decline_reason_length" CHECK ("bookings"."decline_reason" IS NULL OR char_length("bookings"."decline_reason") <= 500);--> statement-breakpoint
-- Ajout manuel (drizzle ne sait pas déclarer EXCLUDE) : filet anti-chevauchement
-- en base, en plus du verrou applicatif. Deux réservations actives d'un même
-- barber ne peuvent pas se chevaucher (intervalles semi-ouverts [start, end)).
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap" EXCLUDE USING gist ("barber_profile_id" WITH =, tstzrange("start_at", "end_at", '[)') WITH &&) WHERE ("status" IN ('PENDING', 'CONFIRMED'));
