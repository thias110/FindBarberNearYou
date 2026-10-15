CREATE TYPE "public"."booking_payment_status" AS ENUM('NOT_REQUIRED', 'REQUIRES_PAYMENT', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."payment_mode" AS ENUM('NONE', 'DEPOSIT', 'FULL');--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD COLUMN "stripe_account_id" text;--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD COLUMN "stripe_charges_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD COLUMN "payment_mode" "payment_mode" DEFAULT 'NONE' NOT NULL;--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD COLUMN "deposit_percent" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_status" "booking_payment_status" DEFAULT 'NOT_REQUIRED' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "amount_due_minor" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "platform_fee_minor" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stripe_checkout_session_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stripe_checkout_url" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "stripe_payment_intent_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_error" text;--> statement-breakpoint
CREATE UNIQUE INDEX "barber_profiles_stripe_account_unique" ON "barber_profiles" USING btree ("stripe_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bookings_stripe_checkout_session_unique" ON "bookings" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "bookings_payment_status_idx" ON "bookings" USING btree ("payment_status");--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD CONSTRAINT "barber_profiles_deposit_percent_range" CHECK ("barber_profiles"."deposit_percent" BETWEEN 10 AND 90);