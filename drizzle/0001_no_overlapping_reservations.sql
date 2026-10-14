-- Prevent double-booking at the database level.
-- Two confirmed reservations for the same resource cannot have overlapping times.
-- '[)' means the end time is exclusive, so 9:00-10:00 and 10:00-11:00 are both allowed.
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "no_overlapping_reservations"
  EXCLUDE USING gist (
    "resource_id" WITH =,
    tstzrange("start_time", "end_time", '[)') WITH &&
  )
  WHERE ("status" = 'confirmed');
