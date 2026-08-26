const path = require('path');
const crypto = require('crypto');
const express = require('express');
const OpenApiValidator = require('express-openapi-validator');

const app = express();
app.use(express.json());

app.use(
    OpenApiValidator.middleware({
        apiSpec: path.join(__dirname, '..', 'openapi', 'openapi.yaml'),
        validateRequests: true,
        validateResponses: true,
    }),
);

const listings = [
    { id: 1, title: 'Квартира на Подоле', city: 'Kyiv', price_cents: 260000 },
    { id: 2, title: 'Лофт на Рибальському', city: 'Kyiv', price_cents: 310000 },
    { id: 3, title: 'Будинок біля моря', city: 'Odesa', price_cents: 450000 },
    { id: 4, title: 'Студія в центрі', city: 'Lviv', price_cents: 180000 },
    { id: 5, title: 'Шале в Карпатах', city: 'Bukovel', price_cents: 520000 },
];

const bookings = [];
const idempotencyKeys = new Map();

function problem(res, req, status, title, detail, type) {
    return res.status(status).type('application/problem+json').json({
        type: type || 'about:blank',
        title,
        status,
        detail,
        instance: req.originalUrl,
    });
}

function encodeCursor(id) {
    return Buffer.from(String(id), 'utf8').toString('base64');
}

function decodeCursor(cursor) {
    const id = Number(Buffer.from(cursor, 'base64').toString('utf8'));
    if (!Number.isInteger(id) || id < 1) {
        const err = new Error('cursor is not a valid opaque token');
        err.status = 400;
        throw err;
    }
    return id;
}

function hashBody(body) {
    return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
}

app.get('/listings', (req, res) => {
    const limit = Number(req.query.limit ?? 20);
    let rows = listings.slice().sort((a, b) => a.id - b.id);
    if (req.query.cursor) {
        const afterId = decodeCursor(req.query.cursor);
        rows = rows.filter((row) => row.id > afterId);
    }
    const items = rows.slice(0, limit);
    const next_cursor = rows.length > limit ? encodeCursor(items[items.length - 1].id) : null;
    res.json({ items, next_cursor });
});

app.get('/listings/:listingId', (req, res) => {
    const listing = listings.find((row) => row.id === Number(req.params.listingId));
    if (!listing) {
        return problem(res, req, 404, 'Not Found', 'Listing not found');
    }
    res.json(listing);
});

app.get('/bookings', (_req, res) => {
    res.json(bookings);
});

app.get('/bookings/:bookingId', (req, res) => {
    const booking = bookings.find((row) => row.id === Number(req.params.bookingId));
    if (!booking) {
        return problem(res, req, 404, 'Not Found', 'Booking not found');
    }
    res.json(booking);
});

app.post('/bookings', (req, res) => {
    const key = req.headers['idempotency-key'];
    const hash = hashBody(req.body);
    const seen = idempotencyKeys.get(key);

    if (seen) {
        if (seen.hash !== hash) {
            return problem(
                res,
                req,
                422,
                'Idempotency key conflict',
                'The same Idempotency-Key was reused with a different request body.',
                'https://minibnb.local/problems/idempotency-key-conflict',
            );
        }
        res.set('Idempotency-Replay', 'true');
        return res.status(201).json(seen.booking);
    }

    const listing = listings.find((row) => row.id === req.body.listing_id);
    if (!listing) {
        return problem(res, req, 404, 'Not Found', 'Listing not found');
    }

    const nights = Math.round(
        (new Date(req.body.check_out) - new Date(req.body.check_in)) / 86400000,
    );
    if (nights < 1) {
        return problem(res, req, 400, 'Invalid dates', 'check_out must be after check_in');
    }

    const booking = {
        id: bookings.length + 1,
        listing_id: listing.id,
        check_in: req.body.check_in,
        check_out: req.body.check_out,
        guests: req.body.guests,
        total_cents: listing.price_cents * nights,
        status: 'confirmed',
    };

    bookings.push(booking);
    idempotencyKeys.set(key, { hash, booking });
    res.status(201).json(booking);
});

app.use((err, req, res, _next) => {
    const status = err.status || 500;
    res.status(status).type('application/problem+json').json({
        type: 'about:blank',
        title: status === 500 ? 'Internal Server Error' : 'Bad Request',
        status,
        detail: err.message,
        instance: req.originalUrl,
    });
});

module.exports = app;