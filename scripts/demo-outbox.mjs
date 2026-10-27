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

    const first = await placeBooking(pool, { key: 'hw22-outbox' });
    const second = await placeBooking(pool, { key: 'hw22-outbox' });
    const requests = 2;

    const consume = consumeUntil(ch, pool, 1);
    const publishedNow = await relayOnce(pool, ch);
    const { deliveries, applied } = await consume;

    const n = await counts(pool);
    printKv({
        requests,
        orders: n.orders,
        outbox: n.outbox,
        published: n.published,
        deliveries,
        effect: n.effect,
        processed: n.processed,
        applied,
        replay: second.replay ? 1 : 0,
        first: first.bookingId,
    });

    await pool.end();
    await ch.close();
    await conn.close();

    if (
        requests !== 2 ||
        n.orders !== 1 ||
        n.outbox !== 1 ||
        n.published !== 1 ||
        n.effect !== 1 ||
        n.processed !== 1
    ) {
        fail('demo:outbox invariant failed');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
