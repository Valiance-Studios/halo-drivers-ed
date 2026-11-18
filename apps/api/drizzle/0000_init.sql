CREATE TYPE "public"."faction" AS ENUM('unsc', 'covenant');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin');--> statement-breakpoint
CREATE TYPE "public"."vehicle_domain" AS ENUM('ground', 'air');--> statement-breakpoint
CREATE TABLE "allowed_users" (
	"email" text PRIMARY KEY NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allowed_users_email_lowercase" CHECK ("allowed_users"."email" = lower("allowed_users"."email"))
);
--> statement-breakpoint
CREATE TABLE "instructor_vehicles" (
	"instructor_slug" text NOT NULL,
	"vehicle_slug" text NOT NULL,
	"faction" "faction" NOT NULL,
	CONSTRAINT "instructor_vehicles_instructor_slug_vehicle_slug_pk" PRIMARY KEY("instructor_slug","vehicle_slug")
);
--> statement-breakpoint
CREATE TABLE "instructors" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"faction" "faction" NOT NULL,
	"bio" text NOT NULL,
	CONSTRAINT "instructors_slug_faction_key" UNIQUE("slug","faction")
);
--> statement-breakpoint
CREATE TABLE "vehicle_prerequisites" (
	"vehicle_slug" text NOT NULL,
	"prerequisite_slug" text NOT NULL,
	CONSTRAINT "vehicle_prerequisites_vehicle_slug_prerequisite_slug_pk" PRIMARY KEY("vehicle_slug","prerequisite_slug"),
	CONSTRAINT "vehicle_prerequisites_not_self" CHECK ("vehicle_prerequisites"."vehicle_slug" <> "vehicle_prerequisites"."prerequisite_slug")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"faction" "faction" NOT NULL,
	"domain" "vehicle_domain" NOT NULL,
	"description" text NOT NULL,
	"lesson_minutes" integer NOT NULL,
	"lessons_required" integer NOT NULL,
	CONSTRAINT "vehicles_slug_faction_key" UNIQUE("slug","faction"),
	CONSTRAINT "vehicles_lesson_minutes_positive" CHECK ("vehicles"."lesson_minutes" > 0),
	CONSTRAINT "vehicles_lessons_required_positive" CHECK ("vehicles"."lessons_required" > 0)
);
--> statement-breakpoint
ALTER TABLE "instructor_vehicles" ADD CONSTRAINT "instructor_vehicles_instructor_fkey" FOREIGN KEY ("instructor_slug","faction") REFERENCES "public"."instructors"("slug","faction") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instructor_vehicles" ADD CONSTRAINT "instructor_vehicles_vehicle_fkey" FOREIGN KEY ("vehicle_slug","faction") REFERENCES "public"."vehicles"("slug","faction") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_prerequisites" ADD CONSTRAINT "vehicle_prerequisites_vehicle_slug_vehicles_slug_fk" FOREIGN KEY ("vehicle_slug") REFERENCES "public"."vehicles"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_prerequisites" ADD CONSTRAINT "vehicle_prerequisites_prerequisite_slug_vehicles_slug_fk" FOREIGN KEY ("prerequisite_slug") REFERENCES "public"."vehicles"("slug") ON DELETE cascade ON UPDATE no action;