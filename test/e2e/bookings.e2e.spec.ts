import { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import request from 'supertest';
import { startTestDb, stopTestDb, TestDb } from '../integration/testkit/postgres';
import { createNestApp } from './create-app';

describe('Bookings E2E (full AppModule)', () => {
    let db: TestDb;
    let app: INestApplication;

    beforeAll(async () => {
        db = await startTestDb();
        app = await createNestApp();
    }, 120_000);

    afterAll(async () => {
        if (app) {
            await app.get(Pool).end();
            await app.close();
        }
        if (db) {
            await stopTestDb(db);
        }
    });

    it('creates a booking then reads it back', async () => {
        const health = await request(app.getHttpServer()).get('/health').expect(200);
        expect(health.body.db).toBe('ok');

        const created = await request(app.getHttpServer())
            .post('/bookings')
            .set('Idempotency-Key', 'e2e-create-1')
            .send({
                listing_id: 1,
                check_in: '2026-10-01',
                check_out: '2026-10-05',
                guests: 2,
            })
            .expect(201);

        expect(created.body).toMatchObject({
            listing_id: 1,
            check_in: '2026-10-01',
            check_out: '2026-10-05',
            guests: 2,
            status: 'confirmed',
            total_cents: 1_040_000,
        });

        const read = await request(app.getHttpServer()).get(`/bookings/${created.body.id}`).expect(200);
        expect(read.body).toEqual(created.body);
    });

    it('returns 404 when the listing does not exist', async () => {
        await request(app.getHttpServer())
            .post('/bookings')
            .set('Idempotency-Key', 'e2e-missing-listing')
            .send({
                listing_id: 99999,
                check_in: '2026-10-01',
                check_out: '2026-10-05',
                guests: 1,
            })
            .expect(404);
    });

    it('returns 400 for an invalid listing id', async () => {
        await request(app.getHttpServer()).get('/listings/0').expect(400);
    });
});
