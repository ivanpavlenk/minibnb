import {
    PREFETCH,
    WORK_QUEUE,
    applyEffect,
    depths,
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

const TOTAL = 5;

async function main() {
    const { conn, ch } = await openBroker();
    const pool = await openDb();
    await resetTopology(ch);
    await resetEffects(pool);
    await ch.prefetch(PREFETCH);

    let delivered = 0;
    let acked = 0;

    await ch.consume(
        WORK_QUEUE,
        async (msg) => {
            if (!msg) {
                return;
            }
            delivered += 1;
            const event = parseEvent(msg);
            await applyEffect(pool, event.eventId);
            ch.ack(msg);
            acked += 1;
        },
        { noAck: false },
    );

    for (let i = 1; i <= TOTAL; i += 1) {
        await publishPlaced(ch, {
            eventId: `demo-publish-${Date.now()}-${i}`,
            type: 'order.placed',
            occurredAt: new Date().toISOString(),
            data: { bookingId: String(i) },
        });
    }

    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && acked < TOTAL) {
        await new Promise((r) => setTimeout(r, 50));
    }

    const effect = await effectCount(pool);
    const { work, dlq } = await depths(ch);
    printKv({
        published: TOTAL,
        delivered,
        effect,
        acked,
        dlq,
        prefetch: PREFETCH,
        work,
    });

    await pool.end();
    await ch.close();
    await conn.close();

    if (TOTAL !== 5 || effect !== 5 || dlq !== 0 || PREFETCH < 1 || PREFETCH > 2000) {
        fail('demo:publish invariant failed');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
