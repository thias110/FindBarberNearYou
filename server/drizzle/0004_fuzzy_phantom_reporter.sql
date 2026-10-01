CREATE TABLE "barber_working_hours" (
	"id" text PRIMARY KEY NOT NULL,
	"barber_profile_id" text NOT NULL,
	"weekday" integer NOT NULL,
	"start_minute" integer NOT NULL,
	"end_minute" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "barber_working_hours_weekday_range" CHECK ("barber_working_hours"."weekday" BETWEEN 1 AND 7),
	CONSTRAINT "barber_working_hours_start_range" CHECK ("barber_working_hours"."start_minute" BETWEEN 0 AND 1439),
	CONSTRAINT "barber_working_hours_end_range" CHECK ("barber_working_hours"."end_minute" BETWEEN 1 AND 1440),
	CONSTRAINT "barber_working_hours_order" CHECK ("barber_working_hours"."start_minute" < "barber_working_hours"."end_minute")
);
--> statement-breakpoint
ALTER TABLE "barber_working_hours" ADD CONSTRAINT "barber_working_hours_barber_profile_id_barber_profiles_id_fk" FOREIGN KEY ("barber_profile_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barber_working_hours_profile_weekday_idx" ON "barber_working_hours" USING btree ("barber_profile_id","weekday");--> statement-breakpoint
CREATE UNIQUE INDEX "barber_working_hours_profile_weekday_start_unique" ON "barber_working_hours" USING btree ("barber_profile_id","weekday","start_minute");