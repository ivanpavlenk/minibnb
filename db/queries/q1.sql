SELECT id, listing_id, status, check_in, total_amount FROM bookings WHERE guest_id = 42 AND created_at >= timestamptz '2023-06-01 00:00:00+00' AND created_at < timestamptz '2023-09-01 00:00:00+00'
