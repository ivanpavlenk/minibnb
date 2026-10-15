# Query optimizations (MiniBnB `bookings`)

Main table: `bookings` (100000 rows). Plans from local Postgres in Docker after `schema.sql` + `seed.sql`.

## q1 — guest + date range

`db/queries/q1.sql`

Index: `bookings_guest_created_idx (guest_id, created_at)`.

### Before

```
 Seq Scan on bookings  (cost=0.00..2781.00 rows=69 width=35) (actual time=13.683..20.981 rows=68 loops=1)
   Filter: ((created_at >= '2023-06-01 00:00:00+00'::timestamp with time zone) AND (created_at < '2023-09-01 00:00:00+00'::timestamp with time zone) AND (guest_id = 42))
   Rows Removed by Filter: 99932
   Buffers: shared read=1031
 Planning:
   Buffers: shared hit=65 read=21
 Planning Time: 4.031 ms
 Execution Time: 21.333 ms
```

### After

```
 Bitmap Heap Scan on bookings  (cost=5.27..217.48 rows=67 width=35) (actual time=0.080..0.226 rows=68 loops=1)
   Recheck Cond: ((guest_id = 42) AND (created_at >= '2023-06-01 00:00:00+00'::timestamp with time zone) AND (created_at < '2023-09-01 00:00:00+00'::timestamp with time zone))
   Heap Blocks: exact=68
   Buffers: shared hit=71 read=4
   ->  Bitmap Index Scan on bookings_guest_created_idx  (cost=0.00..5.26 rows=67 width=0) (actual time=0.062..0.062 rows=68 loops=1)
         Index Cond: ((guest_id = 42) AND (created_at >= '2023-06-01 00:00:00+00'::timestamp with time zone) AND (created_at < '2023-09-01 00:00:00+00'::timestamp with time zone))
         Buffers: shared hit=3 read=4
 Planning:
   Buffers: shared hit=143 read=3
 Planning Time: 1.146 ms
 Execution Time: 0.321 ms
```

Seq Scan disappeared; Bitmap Index Scan on `(guest_id, created_at)` replaced a full 1031-page heap read with a handful of index/heap buffers.

## q2 — filter by rare status

`db/queries/q2.sql`

Index: partial `bookings_cancelled_idx ON bookings (guest_id) WHERE status = 'cancelled'`.

### Before

```
 Seq Scan on bookings  (cost=0.00..2281.00 rows=4963 width=29) (actual time=0.021..6.452 rows=5000 loops=1)
   Filter: (status = 'cancelled'::text)
   Rows Removed by Filter: 95000
   Buffers: shared hit=1031
 Planning:
   Buffers: shared hit=70 read=2
 Planning Time: 0.631 ms
 Execution Time: 6.740 ms
```

### After

```
 Bitmap Heap Scan on bookings  (cost=54.71..1148.62 rows=5033 width=29) (actual time=0.501..2.096 rows=5000 loops=1)
   Recheck Cond: (status = 'cancelled'::text)
   Heap Blocks: exact=1031
   Buffers: shared hit=1031 read=6
   ->  Bitmap Index Scan on bookings_cancelled_idx  (cost=0.00..53.45 rows=5033 width=0) (actual time=0.403..0.404 rows=5000 loops=1)
         Buffers: shared read=6
 Planning:
   Buffers: shared hit=129
 Planning Time: 0.884 ms
 Execution Time: 2.345 ms
```

Seq Scan disappeared; Bitmap Index Scan walks only the cancelled slice of the partial index instead of filtering 95000 other rows.

## q3 — `lower(status)`

`db/queries/q3.sql`

Index: expression `bookings_lower_status_idx ON bookings ((lower(status)))`.

### Before

```
 Seq Scan on bookings  (cost=0.00..2531.00 rows=500 width=29) (actual time=0.099..19.492 rows=10000 loops=1)
   Filter: (lower(status) = 'requested'::text)
   Rows Removed by Filter: 90000
   Buffers: shared hit=1031
 Planning:
   Buffers: shared hit=69
 Planning Time: 0.486 ms
 Execution Time: 19.856 ms
```

### After

```
 Bitmap Heap Scan on bookings  (cost=112.14..1289.95 rows=9787 width=29) (actual time=0.508..2.674 rows=10000 loops=1)
   Recheck Cond: (lower(status) = 'requested'::text)
   Heap Blocks: exact=1031
   Buffers: shared hit=1031 read=10
   ->  Bitmap Index Scan on bookings_lower_status_idx  (cost=0.00..110.72 rows=9787 width=0) (actual time=0.406..0.406 rows=10000 loops=1)
         Index Cond: (lower(status) = 'requested'::text)
         Buffers: shared read=10
 Planning:
   Buffers: shared hit=126
 Planning Time: 0.837 ms
 Execution Time: 3.079 ms
```

Seq Scan disappeared; `lower(status)` is an Index Cond on the expression index, so Postgres no longer computes `lower()` on every row of the table.
