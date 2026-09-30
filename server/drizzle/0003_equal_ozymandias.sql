CREATE TYPE "public"."audience" AS ENUM('FEMME', 'HOMME', 'ENFANT');--> statement-breakpoint
CREATE TYPE "public"."technique" AS ENUM('COUPE', 'TAPER', 'DEGRADE', 'LOCKS', 'TRESSES', 'COLORATION', 'BARBE');--> statement-breakpoint
CREATE TABLE "barber_service_audiences" (
	"service_id" text NOT NULL,
	"audience" "audience" NOT NULL,
	CONSTRAINT "barber_service_audiences_service_id_audience_pk" PRIMARY KEY("service_id","audience")
);
--> statement-breakpoint
CREATE TABLE "barber_service_techniques" (
	"service_id" text NOT NULL,
	"technique" "technique" NOT NULL,
	CONSTRAINT "barber_service_techniques_service_id_technique_pk" PRIMARY KEY("service_id","technique")
);
--> statement-breakpoint
ALTER TABLE "barber_service_audiences" ADD CONSTRAINT "barber_service_audiences_service_id_barber_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."barber_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barber_service_techniques" ADD CONSTRAINT "barber_service_techniques_service_id_barber_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."barber_services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "barber_service_audiences_audience_idx" ON "barber_service_audiences" USING btree ("audience");--> statement-breakpoint
CREATE INDEX "barber_service_techniques_technique_idx" ON "barber_service_techniques" USING btree ("technique");