import {
    DLQ,
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

async function main() {
    const { conn, ch } = await openBroker();
    const pool = await openDb();
    await resetTopology(ch);
    await resetEffects(pool);
    await ch.prefetch(1);

    await ch.consume(
        WORK_QUEUE,
        async (msg) => {
            if (!msg) {
                return;
            }
            const event = parseEvent(msg);
            if (event.type === 'poison') {
                ch.reject(msg, false);
                return;
            }
            await applyEffect(pool, event.eventId);
            ch.ack(msg);
        },
        { noAck: false },
    );

    await publishPlaced(ch, {
        eventId: `demo-poison-${Date.now()}`,
        type: 'poison',
        occurredAt: new Date().toISOString(),
        data: { bookingId: '0' },
    });

    const deadline = Date.now() + 15_000;
    let dlqReason = '';
    while (Date.now() < deadline) {
        const { dlq } = await depths(ch);
        if (dlq >= 1) {
            const got = await ch.get(DLQ, { noAck: false });
            if (got) {
                const death = got.properties.headers?.['x-death'];
                const first = Array.isArray(death) ? death[0] : null;
                dlqReason = String(
                    got.properties.headers?.['x-first-death-reason'] ?? first?.reason ?? '',
                );
                ch.nack(got, false, true);
            }
            break;
        }
        await new Promise((r) => setTimeout(r, 50));
    }

    const { work, dlq } = await depths(ch);
    const effect = await effectCount(pool);
    printKv({
        rejected: 1,
        work,
        dlq,
        'dlq-reason': dlqReason,
        effect,
    });

    await pool.end();
    await ch.close();
    await conn.close();

    const allowed = new Set(['rejected', 'expired', 'maxlen', 'delivery_limit']);
    if (work !== 0 || dlq !== 1 || !allowed.has(dlqReason) || effect !== 0) {
        fail('demo:dlq invariant failed');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
