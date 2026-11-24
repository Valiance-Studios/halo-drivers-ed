-- Trusted extension: lets GiST indexes compare plain columns, for the constraints below.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_instructor_free" EXCLUDE USING gist ("instructor_slug" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" <> 'cancelled');--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_free" EXCLUDE USING gist ("vehicle_slug" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" <> 'cancelled');--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_free" EXCLUDE USING gist ("student_email" WITH =, tstzrange("starts_at", "ends_at") WITH &&) WHERE ("status" <> 'cancelled');
