import { io } from 'socket.io-client';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const sameRoom = process.argv.includes('--same-room');

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function http(method, path, { body, headers } = {}) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            ...(body ? { 'content-type': 'application/json' } : {}),
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`${method} ${path} -> ${res.status} ${text}`);
    }
    return { json: text ? JSON.parse(text) : null, res };
}

function connectClient(guestId, orderId) {
    const socket = io(BASE, { auth: { guestId } });
    let received = 0;
    socket.on('order.status', () => {
        received += 1;
    });
    return {
        socket,
        count: () => received,
        join: () =>
            new Promise((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('join timeout')), 5000);
                socket.emit('join', { id: orderId }, (ack) => {
                    clearTimeout(timer);
                    if (!ack?.ok) {
                        reject(new Error(`join failed: ${JSON.stringify(ack)}`));
                        return;
                    }
                    resolve(ack);
                });
            }),
    };
}

async function main() {
    const listings = await http('GET', '/listings?limit=1');
    const listingId = listings.json.items[0]?.id;
    if (!listingId) {
        throw new Error('no listings; seed the database first');
    }

    const keyA = `demo-a-${Date.now()}`;
    const keyB = `demo-b-${Date.now()}`;
    const createdA = await http('POST', '/bookings', {
        headers: { 'Idempotency-Key': keyA },
        body: {
            listing_id: listingId,
            check_in: '2031-01-10',
            check_out: '2031-01-12',
            guests: 1,
        },
    });
    const createdB = await http('POST', '/bookings', {
        headers: { 'Idempotency-Key': keyB },
        body: {
            listing_id: listingId,
            check_in: '2031-02-10',
            check_out: '2031-02-12',
            guests: 1,
        },
    });

    const guestId = createdA.res.headers.get('x-guest-id');
    if (!guestId) {
        throw new Error('missing x-guest-id header on POST /bookings');
    }
    const orderA = String(createdA.json.id);
    const orderB = sameRoom ? orderA : String(createdB.json.id);

    const clientA = connectClient(guestId, orderA);
    const clientB = connectClient(guestId, orderB);
    await Promise.all([
        new Promise((resolve) => clientA.socket.on('connect', resolve)),
        new Promise((resolve) => clientB.socket.on('connect', resolve)),
    ]);
    await clientA.join();
    await clientB.join();

    await http('PATCH', `/bookings/${orderA}/status`, {
        body: { status: 'cancelled' },
    });
    await sleep(1500);

    const aGot = clientA.count() > 0 ? 1 : 0;
    const bGot = clientB.count() > 0 ? 1 : 0;
    const expectB = sameRoom ? 1 : 0;

    console.log(`A_RECEIVED=${aGot}`);
    console.log(`B_RECEIVED=${bGot}`);

    clientA.socket.close();
    clientB.socket.close();

    process.exit(aGot === 1 && bGot === expectB ? 0 : 1);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
