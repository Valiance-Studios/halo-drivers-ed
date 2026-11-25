CREATE TABLE "instructor_time_off" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instructor_slug" text NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	CONSTRAINT "instructor_time_off_order" CHECK ("instructor_time_off"."starts_on" <= "instructor_time_off"."ends_on")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "instructor_time_off" ADD CONSTRAINT "instructor_time_off_instructor_slug_instructors_slug_fk" FOREIGN KEY ("instructor_slug") REFERENCES "public"."instructors"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cancel_reason" CHECK ("bookings"."cancel_reason" is null or ("bookings"."status" = 'cancelled' and char_length("bookings"."cancel_reason") between 1 and 500));