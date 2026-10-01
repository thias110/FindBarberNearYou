CREATE TABLE "barber_time_off" (
	"id" text PRIMARY KEY NOT NULL,
	"barber_profile_id" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "barber_time_off_order" CHECK ("barber_time_off"."start_date" <= "barber_time_off"."end_date"),
	CONSTRAINT "barber_time_off_range" CHECK ("barber_time_off"."end_date" - "barber_time_off"."start_date" <= 365),
	CONSTRAINT "barber_time_off_reason_length" CHECK ("barber_time_off"."reason" IS NULL OR char_length("barber_time_off"."reason") <= 500)
);
--> statement-breakpoint
ALTER TABLE "barber_time_off" ADD CONSTRAINT "barber_time_off_barber_profile_id_barber_profiles_id_fk" FOREIGN KEY ("barber_profile_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barber_time_off_profile_start_idx" ON "barber_time_off" USING btree ("barber_profile_id","start_date");--> statement-breakpoint
CREATE UNIQUE INDEX "barber_time_off_profile_dates_unique" ON "barber_time_off" USING btree ("barber_profile_id","start_date","end_date");