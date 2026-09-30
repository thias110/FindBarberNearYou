CREATE TYPE "public"."currency" AS ENUM('CHF', 'EUR', 'USD');--> statement-breakpoint
CREATE TABLE "barber_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"description" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"postal_code" text,
	"country_code" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"currency" "currency" DEFAULT 'CHF' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "barber_profiles_latitude_range" CHECK ("barber_profiles"."latitude" >= -90 AND "barber_profiles"."latitude" <= 90),
	CONSTRAINT "barber_profiles_longitude_range" CHECK ("barber_profiles"."longitude" >= -180 AND "barber_profiles"."longitude" <= 180)
);
--> statement-breakpoint
CREATE TABLE "barber_services" (
	"id" text PRIMARY KEY NOT NULL,
	"barber_profile_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_minutes" integer NOT NULL,
	"price_minor" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "barber_services_duration_positive" CHECK ("barber_services"."duration_minutes" > 0),
	CONSTRAINT "barber_services_price_non_negative" CHECK ("barber_services"."price_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD CONSTRAINT "barber_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_barber_profile_id_barber_profiles_id_fk" FOREIGN KEY ("barber_profile_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "barber_profiles_user_id_unique" ON "barber_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "barber_services_profile_active_idx" ON "barber_services" USING btree ("barber_profile_id","is_active");