ALTER TABLE "bookings" ADD COLUMN "student_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "private_note" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_note_length" CHECK (char_length("bookings"."student_note") <= 1000 and char_length("bookings"."private_note") <= 1000);