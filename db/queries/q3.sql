SELECT id, guest_id, listing_id, total_amount FROM bookings WHERE lower(status) = 'requested'
