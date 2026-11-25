-- An instructor's time off cannot overlap. Both days are included. Uses btree_gist, from 0002.
ALTER TABLE "instructor_time_off" ADD CONSTRAINT "instructor_time_off_free" EXCLUDE USING gist ("instructor_slug" WITH =, daterange("starts_on", "ends_on", '[]') WITH &&);
