import amqp from 'amqplib';
import pg from 'pg';
import { createHash } from 'node:crypto';
import { brokerUrl, databaseUrl, PREFETCH, publishPlaced, resetTopology, WORK_QUEUE } from './rabbit-hw19.mjs';

export const CONSUMER = 'order-placed';

export function printKv(rows) {
    for (const [key, value] of Object.entries(rows)) {
        console.log(`${key}=${value}`);
    }
}

export function fail(message) {
    console.error(message);
    process.exit(1);
}

export async function openBroker() {
    const conn = await amqp.connect(brokerUrl());
    const ch = await conn.createConfirmChannel();
    await resetTopology(ch);
    await ch.prefetch(PREFETCH);
    return { conn, ch };
}

export async function openDb() {
    const pool = new pg.Pool({ connectionString: databaseUrl() });
    await ensureSchema(pool);
    return pool;
}

export async function ensureSchema(pool) {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            email text NOT NULL UNIQUE,
            role text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            balance_cents integer NOT NULL DEFAULT 0
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS listings (
            id BIGSERIAL PRIMARY KEY,
            owner_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            title text NOT NULL,
            city text NOT NULL,
            price_per_night integer NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            stock integer NOT NULL DEFAULT 1
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS bookings (
            id BIGSERIAL PRIMARY KEY,
            listing_id bigint NOT NULL REFERENCES listings(id) ON DELETE RESTRICT,
            guest_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            check_in date NOT NULL,
            check_out date NOT NULL,
            status text NOT NULL,
            total_amount integer NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            CHECK (check_out > check_in)
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS outbox (
            id BIGSERIAL PRIMARY KEY,
            aggregate_type text NOT NULL,
            aggregate_id text NOT NULL,
            type text NOT NULL,
            payload jsonb NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            published_at timestamptz,
            attempts integer NOT NULL DEFAULT 0
        )
    `);
    await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox (created_at, id) WHERE published_at IS NULL`,
    );
    await pool.query(`
        CREATE TABLE IF NOT EXISTS processed_messages (
            message_id text NOT NULL,
            consumer text NOT NULL,
            processed_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (message_id, consumer)
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS idempotency_keys (
            key text PRIMARY KEY,
            booking_id bigint NOT NULL,
            request_hash text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS order_placed_effects (
            booking_id text PRIMARY KEY,
            applied_at timestamptz NOT NULL DEFAULT now()
        )
    `);
}

export async function resetDemoState(pool) {
    await pool.query(`
        TRUNCATE TABLE
            order_placed_effects,
            processed_messages,
            idempotency_keys,
            outbox,
            bookings
        RESTART IDENTITY CASCADE
    `);
}

export async function seedListing(pool) {
    await pool.query(
        `INSERT INTO users (email, role, balance_cents)
         VALUES ('outbox.host@minibnb.test', 'host', 0)
         ON CONFLICT (email) DO NOTHING`,
    );
    const { rows } = await pool.query(`SELECT id FROM users WHERE email = 'outbox.host@minibnb.test'`);
    await pool.query(
        `INSERT INTO listings (id, owner_id, title, city, price_per_night, stock)
         VALUES (1, $1, 'Outbox loft', 'Kyiv', 10000, 1)
         ON CONFLICT (id) DO NOTHING`,
        [rows[0].id],
    );
    await pool.query(
        `SELECT setval(pg_get_serial_sequence('listings', 'id'), (SELECT COALESCE(MAX(id), 1) FROM listings))`,
    );
}

export async function seedGuest(pool) {
    const { rows } = await pool.query(
        `INSERT INTO users (email, role, balance_cents)
         VALUES ('guest@minibnb.test', 'guest', 0)
         ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role
         RETURNING id`,
    );
    return String(rows[0].id);
}

function hashBody(body) {
    return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

export async function placeBooking(pool, { key, crashAfterOutbox = false }) {
    const body = {
        listing_id: 1,
        check_in: '2026-11-01',
        check_out: '2026-11-03',
        guests: 2,
    };
    const hash = hashBody(body);
    const guestId = await seedGuest(pool);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const seen = await client.query(
            `SELECT booking_id, request_hash FROM idempotency_keys WHERE key = $1`,
            [key],
        );
        if (seen.rows[0]) {
            await client.query('COMMIT');
            return { replay: true, bookingId: String(seen.rows[0].booking_id) };
        }
        const listing = await client.query(`SELECT id, price_per_night FROM listings WHERE id = 1`);
        const nights = 2;
        const saved = await client.query(
            `INSERT INTO bookings (listing_id, guest_id, check_in, check_out, status, total_amount)
             VALUES ($1, $2, $3, $4, 'confirmed', $5)
             RETURNING id, listing_id`,
            [listing.rows[0].id, guestId, body.check_in, body.check_out, listing.rows[0].price_per_night * nights],
        );
        const booking = saved.rows[0];
        const event = {
            eventId: `booking:${booking.id}:placed`,
            type: 'order.placed',
            occurredAt: new Date().toISOString(),
            data: { bookingId: String(booking.id), listingId: String(booking.listing_id) },
        };
        await client.query(
            `INSERT INTO outbox (aggregate_type, aggregate_id, type, payload)
             VALUES ('booking', $1, $2, $3::jsonb)`,
            [String(booking.id), event.type, JSON.stringify(event)],
        );
        await client.query(
            `INSERT INTO idempotency_keys (key, booking_id, request_hash)
             VALUES ($1, $2, $3)`,
            [key, booking.id, hash],
        );
        if (crashAfterOutbox) {
            await client.query('ROLLBACK');
            return { replay: false, crashed: true, bookingId: null };
        }
        await client.query('COMMIT');
        return { replay: false, crashed: false, bookingId: String(booking.id) };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
    } finally {
        client.release();
    }
}

export async function relayOnce(pool, ch, { crashAfterPublish = false } = {}) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT id, payload
             FROM outbox
             WHERE published_at IS NULL
             ORDER BY created_at, id
             FOR UPDATE SKIP LOCKED
             LIMIT 1`,
        );
        if (!rows[0]) {
            await client.query('COMMIT');
            return 0;
        }
        await publishPlaced(ch, rows[0].payload);
        if (crashAfterPublish) {
            await client.query('ROLLBACK');
            return 1;
        }
        await client.query(
            `UPDATE outbox SET published_at = now(), attempts = attempts + 1 WHERE id = $1`,
            [rows[0].id],
        );
        await client.query('COMMIT');
        return 1;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
    } finally {
        client.release();
    }
}

export async function applyDelivery(pool, event) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(
            `INSERT INTO processed_messages (message_id, consumer)
             VALUES ($1, $2)
             ON CONFLICT (message_id, consumer) DO NOTHING`,
            [event.eventId, CONSUMER],
        );
        const applied = await client.query(
            `INSERT INTO order_placed_effects (booking_id)
             VALUES ($1)
             ON CONFLICT (booking_id) DO NOTHING
             RETURNING booking_id`,
            [String(event.data.bookingId)],
        );
        await client.query('COMMIT');
        return applied.rowCount === 1;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
    } finally {
        client.release();
    }
}

export async function consumeUntil(ch, pool, want, timeoutMs = 10_000) {
    let deliveries = 0;
    let applied = 0;
    await ch.consume(
        WORK_QUEUE,
        async (msg) => {
            if (!msg) {
                return;
            }
            deliveries += 1;
            const event = JSON.parse(msg.content.toString());
            const did = await applyDelivery(pool, event);
            if (did) {
                applied += 1;
            }
            ch.ack(msg);
        },
        { noAck: false },
    );
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && deliveries < want) {
        await new Promise((r) => setTimeout(r, 40));
    }
    return { deliveries, applied };
}

export async function counts(pool) {
    const orders = await pool.query('SELECT count(*)::int AS n FROM bookings');
    const outbox = await pool.query('SELECT count(*)::int AS n FROM outbox');
    const published = await pool.query(
        'SELECT count(*)::int AS n FROM outbox WHERE published_at IS NOT NULL',
    );
    const effect = await pool.query('SELECT count(*)::int AS n FROM order_placed_effects');
    const processed = await pool.query('SELECT count(*)::int AS n FROM processed_messages');
    return {
        orders: orders.rows[0].n,
        outbox: outbox.rows[0].n,
        published: published.rows[0].n,
        effect: effect.rows[0].n,
        processed: processed.rows[0].n,
    };
}
