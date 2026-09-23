INSERT INTO users (email, role)
SELECT format('guest%s@minibnb.test', gs), 'guest'
FROM generate_series(1, 400) AS gs;

INSERT INTO users (email, role)
SELECT format('host%s@minibnb.test', gs), 'host'
FROM generate_series(1, 100) AS gs;

-- guests: id 1..400, hosts: id 401..500

INSERT INTO listings (owner_id, title, city, price_per_night)
SELECT
    400 + 1 + ((gs - 1) % 100),
    format('Stay %s', gs),
    (ARRAY['Kyiv', 'Lviv', 'Odesa', 'Kharkiv', 'Dnipro'])[1 + ((gs - 1) % 5)],
    (80 + (gs % 150))::numeric(12, 2)
FROM generate_series(1, 300) AS gs;

INSERT INTO bookings (
    listing_id, guest_id, check_in, check_out, status, total_amount, created_at
)
SELECT
    1 + ((gs - 1) % 300),
    1 + ((gs - 1) % 400),
    DATE '2023-01-01' + ((gs * 3) % 700),
    DATE '2023-01-01' + ((gs * 3) % 700) + 2 + (gs % 6),
    CASE
    WHEN gs % 20 = 0 THEN 'cancelled'
    WHEN gs % 10 = 1 THEN 'requested'
    ELSE 'confirmed'
END,
  ((80 + (gs % 150)) * (2 + (gs % 6)))::numeric(12, 2),
  timestamptz '2023-01-01 00:00:00+00' + (gs * interval '3 minutes')
FROM generate_series(1, 100000) AS gs;

INSERT INTO reviews (booking_id, rating, body)
SELECT id, 1 + (id % 5), 'ok'
FROM bookings
WHERE status = 'confirmed' AND id % 20 = 0;

VACUUM (ANALYZE);