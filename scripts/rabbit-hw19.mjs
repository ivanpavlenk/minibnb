import amqp from 'amqplib';
import pg from 'pg';

export const EVENTS_EXCHANGE = 'shop.events';
export const WORK_QUEUE = 'shop.order.placed.q';
export const ROUTING_KEY = 'order.placed';
export const DLX = 'shop.dlx';
export const DLQ = 'shop.dlq';
export const PREFETCH = 10;

export function brokerUrl() {
    const url = process.env.BROKER_URL;
    if (!url) {
        throw new Error('BROKER_URL is required');
    }
    return url;
}

export function databaseUrl() {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL is required');
    }
    return url;
}

export async function openBroker() {
    const conn = await amqp.connect(brokerUrl());
    const ch = await conn.createConfirmChannel();
    return { conn, ch };
}

export async function assertTopology(ch) {
    await ch.assertExchange(DLX, 'fanout', { durable: true });
    await ch.assertQueue(DLQ, {
        durable: true,
        arguments: { 'x-queue-type': 'quorum' },
    });
    await ch.bindQueue(DLQ, DLX, '');

    await ch.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(WORK_QUEUE, {
        durable: true,
        arguments: {
            'x-queue-type': 'quorum',
            'x-dead-letter-exchange': DLX,
        },
    });
    await ch.bindQueue(WORK_QUEUE, EVENTS_EXCHANGE, ROUTING_KEY);
}

export async function resetTopology(ch) {
    try {
        await ch.deleteQueue(WORK_QUEUE);
    } catch {
        /* first run */
    }
    try {
        await ch.deleteQueue(DLQ);
    } catch {
        /* first run */
    }
    await assertTopology(ch);
}

export async function publishPlaced(ch, event) {
    const ok = ch.publish(EVENTS_EXCHANGE, ROUTING_KEY, Buffer.from(JSON.stringify(event)), {
        persistent: true,
        contentType: 'application/json',
        messageId: event.eventId,
        mandatory: true,
    });
    if (!ok) {
        throw new Error('publish buffer full');
    }
    await ch.waitForConfirms();
}

export function parseEvent(msg) {
    return JSON.parse(msg.content.toString());
}

export async function openDb() {
    const pool = new pg.Pool({ connectionString: databaseUrl() });
    await pool.query(`
        CREATE TABLE IF NOT EXISTS processed_events (
            event_id text PRIMARY KEY,
            processed_at timestamptz NOT NULL DEFAULT now()
        )
    `);
    return pool;
}

export async function resetEffects(pool) {
    await pool.query('TRUNCATE processed_events');
}

export async function applyEffect(pool, eventId) {
    const result = await pool.query(
        `INSERT INTO processed_events (event_id)
         VALUES ($1)
         ON CONFLICT (event_id) DO NOTHING
         RETURNING event_id`,
        [eventId],
    );
    return result.rowCount === 1;
}

export async function effectCount(pool) {
    const result = await pool.query('SELECT count(*)::int AS n FROM processed_events');
    return result.rows[0].n;
}

export async function depths(ch) {
    const work = await ch.checkQueue(WORK_QUEUE);
    const dlq = await ch.checkQueue(DLQ);
    return { work: work.messageCount, dlq: dlq.messageCount };
}

export function printKv(rows) {
    for (const [key, value] of Object.entries(rows)) {
        console.log(`${key}=${value}`);
    }
}

export function fail(message) {
    console.error(message);
    process.exit(1);
}
