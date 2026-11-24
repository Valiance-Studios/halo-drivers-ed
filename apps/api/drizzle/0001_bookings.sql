CREATE TYPE "public"."booking_status" AS ENUM('booked', 'completed', 'missed', 'cancelled');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_email" text NOT NULL,
	"instructor_slug" text NOT NULL,
	"vehicle_slug" text NOT NULL,
	"faction" "faction" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "booking_status" DEFAULT 'booked' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_order" CHECK ("bookings"."starts_at" < "bookings"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "instructor_availability" (
	"instructor_slug" text NOT NULL,
	"weekday" integer NOT NULL,
	"starts_at" time(0) NOT NULL,
	"ends_at" time(0) NOT NULL,
	CONSTRAINT "instructor_availability_instructor_slug_weekday_starts_at_pk" PRIMARY KEY("instructor_slug","weekday","starts_at"),
	CONSTRAINT "instructor_availability_weekday" CHECK ("instructor_availability"."weekday" between 1 and 7),
	CONSTRAINT "instructor_availability_order" CHECK ("instructor_availability"."starts_at" < "instructor_availability"."ends_at")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_student_email_allowed_users_email_fk" FOREIGN KEY ("student_email") REFERENCES "public"."allowed_users"("email") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_instructor_fkey" FOREIGN KEY ("instructor_slug","faction") REFERENCES "public"."instructors"("slug","faction") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_fkey" FOREIGN KEY ("vehicle_slug","faction") REFERENCES "public"."vehicles"("slug","faction") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_availability" ADD CONSTRAINT "instructor_availability_instructor_slug_instructors_slug_fk" FOREIGN KEY ("instructor_slug") REFERENCES "public"."instructors"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_student_idx" ON "bookings" USING btree ("student_email","starts_at");