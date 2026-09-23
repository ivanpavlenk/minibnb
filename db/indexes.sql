CREATE INDEX bookings_guest_created_idx
  ON bookings (guest_id, created_at);

CREATE INDEX bookings_cancelled_idx
  ON bookings (guest_id)
  WHERE status = 'cancelled';

CREATE INDEX bookings_lower_status_idx
  ON bookings ((lower(status)));