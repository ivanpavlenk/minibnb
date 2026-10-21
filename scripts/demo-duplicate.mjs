import {
    PREFETCH,
    WORK_QUEUE,
    applyEffect,
    effectCount,
    fail,
    openBroker,
    openDb,
    parseEvent,
    printKv,
    publishPlaced,
    resetEffects,
    resetTopology,
} from './rabbit-hw19.mjs';

async function main() {
    const { conn, ch } = await openBroker();
    const pool = await openDb();
    await resetTopology(ch);
    await resetEffects(pool);
    await ch.prefetch(PREFETCH);

    const eventId = `demo-dup-${Date.now()}`;
    let deliveries = 0;
    let acked = 0;

    await ch.consume(
        WORK_QUEUE,
        async (msg) => {
            if (!msg) {
                return;
            }
            deliveries += 1;
            const event = parseEvent(msg);
            await applyEffect(pool, event.eventId);
            if (deliveries === 1) {
                ch.nack(msg, false, true);
                return;
            }
            ch.ack(msg);
            acked += 1;
        },
        { noAck: false },
    );

    await publishPlaced(ch, {
        eventId,
        type: 'order.placed',
        occurredAt: new Date().toISOString(),
        data: { bookingId: '42' },
    });

    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && acked < 1) {
        await new Promise((r) => setTimeout(r, 50));
    }

    const effect = await effectCount(pool);
    printKv({
        deliveries,
        effect,
        skipped: Math.max(0, deliveries - effect),
    });

    await pool.end();
    await ch.close();
    await conn.close();

    if (deliveries < 2 || effect !== 1) {
        fail('demo:duplicate invariant failed');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
