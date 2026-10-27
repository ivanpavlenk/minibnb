import {
    consumeUntil,
    counts,
    fail,
    openBroker,
    openDb,
    placeBooking,
    printKv,
    relayOnce,
    resetDemoState,
    seedListing,
} from './outbox-hw22.mjs';

async function main() {
    const { conn, ch } = await openBroker();
    const pool = await openDb();
    await resetDemoState(pool);
    await seedListing(pool);

    const result = await placeBooking(pool, { key: 'hw22-crash-write', crashAfterOutbox: true });
    const consume = consumeUntil(ch, pool, 1, 1500);
    await relayOnce(pool, ch);
    const { deliveries } = await consume;
    const n = await counts(pool);

    printKv({
        'write-failed': result.crashed ? 1 : 0,
        orders: n.orders,
        outbox: n.outbox,
        published: n.published,
        deliveries,
        effect: n.effect,
    });

    await pool.end();
    await ch.close();
    await conn.close();

    if (
        !result.crashed ||
        n.orders !== 0 ||
        n.outbox !== 0 ||
        n.published !== 0 ||
        deliveries !== 0 ||
        n.effect !== 0
    ) {
        fail('demo:crash-write invariant failed');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
