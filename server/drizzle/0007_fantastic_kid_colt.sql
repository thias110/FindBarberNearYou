CREATE TYPE "public"."service_place" AS ENUM('SALON', 'AT_PROVIDER', 'AT_CLIENT');--> statement-breakpoint
CREATE TABLE "barber_profile_places" (
	"barber_profile_id" text NOT NULL,
	"place" "service_place" NOT NULL,
	CONSTRAINT "barber_profile_places_barber_profile_id_place_pk" PRIMARY KEY("barber_profile_id","place")
);
--> statement-breakpoint
ALTER TABLE "barber_profiles" ALTER COLUMN "address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD COLUMN "travel_radius_km" integer;--> statement-breakpoint
ALTER TABLE "barber_profile_places" ADD CONSTRAINT "barber_profile_places_barber_profile_id_barber_profiles_id_fk" FOREIGN KEY ("barber_profile_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barber_profile_places_place_idx" ON "barber_profile_places" USING btree ("place");--> statement-breakpoint
ALTER TABLE "barber_profiles" ADD CONSTRAINT "barber_profiles_travel_radius_range" CHECK ("barber_profiles"."travel_radius_km" IS NULL OR "barber_profiles"."travel_radius_km" BETWEEN 1 AND 100);