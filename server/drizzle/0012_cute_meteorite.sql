CREATE TABLE "barber_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"barber_profile_id" text NOT NULL,
	"image_path" text NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "barber_photos_caption_length" CHECK ("barber_photos"."caption" IS NULL OR char_length("barber_photos"."caption") <= 300)
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_path" text;--> statement-breakpoint
ALTER TABLE "barber_photos" ADD CONSTRAINT "barber_photos_barber_profile_id_barber_profiles_id_fk" FOREIGN KEY ("barber_profile_id") REFERENCES "public"."barber_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barber_photos_profile_created_idx" ON "barber_photos" USING btree ("barber_profile_id","created_at");