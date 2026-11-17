BEGIN;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS journey_estimate jsonb;
COMMENT ON COLUMN bookings.journey_estimate IS 'Server-calculated, unconfirmed estimate snapshot. NULL for ordinary booking enquiries.';
COMMIT;
