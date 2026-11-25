ALTER TYPE "public"."role" ADD VALUE 'guest';--> statement-breakpoint
CREATE TABLE "demo_slots" (
	"id" integer PRIMARY KEY NOT NULL,
	"uid" text,
	"guest_email" text,
	"expires_at" timestamp with time zone,
	CONSTRAINT "demo_slots_uid_unique" UNIQUE("uid"),
	CONSTRAINT "demo_slots_guestEmail_unique" UNIQUE("guest_email"),
	CONSTRAINT "demo_slots_id_positive" CHECK ("demo_slots"."id" > 0),
	CONSTRAINT "demo_slots_session" CHECK (num_nonnulls("demo_slots"."uid", "demo_slots"."guest_email", "demo_slots"."expires_at") in (0, 3))
);
--> statement-breakpoint
ALTER TABLE "demo_slots" ADD CONSTRAINT "demo_slots_guest_email_allowed_users_email_fk" FOREIGN KEY ("guest_email") REFERENCES "public"."allowed_users"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allowed_users" ADD CONSTRAINT "allowed_users_guest_email" CHECK (("allowed_users"."role"::text = 'guest') = ("allowed_users"."email" like '%@demo.invalid'));