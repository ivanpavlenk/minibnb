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

    await placeBooking(pool, { key: 'hw22-crash-relay' });

    const consume = consumeUntil(ch, pool, 2, 12_000);
    const firstPublish = await relayOnce(pool, ch, { crashAfterPublish: true });
    const secondPublish = await relayOnce(pool, ch, { crashAfterPublish: false });
    const { deliveries, applied } = await consume;
    const n = await counts(pool);

    printKv({
        published: firstPublish + secondPublish,
        deliveries,
        applied,
        effect: n.effect,
        processed: n.processed,
    });

    await pool.end();
    await ch.close();
    await conn.close();

    if (deliveries < 2 || applied !== 1 || n.effect !== 1 || n.processed !== 1) {
        fail('demo:crash-relay invariant failed');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
