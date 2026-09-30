ALTER TABLE "barber_services" DROP CONSTRAINT "barber_services_duration_positive";--> statement-breakpoint
ALTER TABLE "barber_services" DROP CONSTRAINT "barber_services_price_non_negative";--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_duration_range" CHECK ("barber_services"."duration_minutes" BETWEEN 1 AND 480);--> statement-breakpoint
ALTER TABLE "barber_services" ADD CONSTRAINT "barber_services_price_range" CHECK ("barber_services"."price_minor" BETWEEN 0 AND 1000000);