CREATE TYPE "public"."booking_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" text PRIMARY KEY NOT NULL,
	"client_user_id" text NOT NULL,
	"barber_profile_id" text NOT NULL,
	"service_id" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"service_place" "service_place" NOT NULL,
	"status" "booking_status" DEFAULT 'PENDING' NOT NULL,
	"barber_display_name" text NOT NULL,
	"service_name" text NOT NULL,
	"service_description" text,
	"duration_minutes" integer NOT NULL,
	"price_minor" integer NOT NULL,
	"currency" "currency" NOT NULL,
	"client_address" text,
	"client_city" text,
	"client_postal_code" text,
	"client_country_code" text,
	"client_latitude" double precision,
	"client_longitude" double precision,
	"cancelled_by" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_period_order" CHECK ("bookings"."start_at" < "bookings"."end_at"),
	CONSTRAINT "bookings_duration_range" CHECK ("bookings"."duration_minutes" BETWEEN 1 AND 480),
	CONSTRAINT "bookings_price_range" CHECK ("bookings"."price_minor" BETWEEN 0 AND 1000000),
	CONSTRAINT "bookings_client_latitude_range" CHECK ("bookings"."client_latitude" IS NULL OR "bookings"."client_latitude" BETWEEN -90 AND 90),
	CONSTRAINT "bookings_client_longitude_range" CHECK ("bookings"."client_longitude" IS NULL OR "bookings"."client_longitude" BETWEEN -180 AND 180)
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_user_id_users_id_fk" FOREIGN KEY ("client_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_barber_profile_id_barber_profiles_id_fk" FOREIGN KEY ("barber_profile_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_barber_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."barber_services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_barber_start_idx" ON "bookings" USING btree ("barber_profile_id","start_at");--> statement-breakpoint
CREATE INDEX "bookings_client_start_idx" ON "bookings" USING btree ("client_user_id","start_at");--> statement-breakpoint
CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");