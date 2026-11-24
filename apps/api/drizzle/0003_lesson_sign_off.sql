CREATE TYPE "public"."skill_result" AS ENUM('pass', 'fail');--> statement-breakpoint
ALTER TYPE "public"."booking_status" ADD VALUE 'repeat';--> statement-breakpoint
ALTER TYPE "public"."role" ADD VALUE 'student';--> statement-breakpoint
CREATE TABLE "course_lessons" (
	"vehicle_slug" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "course_lessons_vehicle_slug_number_pk" PRIMARY KEY("vehicle_slug","number"),
	CONSTRAINT "course_lessons_number_positive" CHECK ("course_lessons"."number" > 0)
);
--> statement-breakpoint
CREATE TABLE "lesson_skills" (
	"vehicle_slug" text NOT NULL,
	"lesson_number" integer NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"label" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "lesson_skills_vehicle_slug_lesson_number_id_pk" PRIMARY KEY("vehicle_slug","lesson_number","id")
);
--> statement-breakpoint
CREATE TABLE "skill_results" (
	"booking_id" uuid NOT NULL,
	"vehicle_slug" text NOT NULL,
	"lesson_number" integer NOT NULL,
	"skill_id" text NOT NULL,
	"result" "skill_result" NOT NULL,
	CONSTRAINT "skill_results_booking_id_lesson_number_skill_id_pk" PRIMARY KEY("booking_id","lesson_number","skill_id")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "lesson_number" integer;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "signed_off_by" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "signed_off_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "course_lessons" ADD CONSTRAINT "course_lessons_vehicle_slug_vehicles_slug_fk" FOREIGN KEY ("vehicle_slug") REFERENCES "public"."vehicles"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_skills" ADD CONSTRAINT "lesson_skills_lesson_fkey" FOREIGN KEY ("vehicle_slug","lesson_number") REFERENCES "public"."course_lessons"("vehicle_slug","number") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_id_vehicle_key" UNIQUE("id","vehicle_slug");--> statement-breakpoint
ALTER TABLE "skill_results" ADD CONSTRAINT "skill_results_booking_fkey" FOREIGN KEY ("booking_id","vehicle_slug") REFERENCES "public"."bookings"("id","vehicle_slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_results" ADD CONSTRAINT "skill_results_skill_fkey" FOREIGN KEY ("vehicle_slug","lesson_number","skill_id") REFERENCES "public"."lesson_skills"("vehicle_slug","lesson_number","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lesson_fkey" FOREIGN KEY ("vehicle_slug","lesson_number") REFERENCES "public"."course_lessons"("vehicle_slug","number") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_lesson_number" CHECK (("bookings"."status"::text in ('completed', 'repeat')) = ("bookings"."lesson_number" is not null));--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_signed_off" CHECK (("bookings"."status"::text in ('completed', 'repeat', 'missed')) = ("bookings"."signed_off_by" is not null and "bookings"."signed_off_at" is not null));