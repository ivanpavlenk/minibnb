import path from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Verifier } from '@pact-foundation/pact';
import { Pool } from 'pg';
import { DataSource } from 'typeorm';
import { ensureListingOne } from '../../src/listings/seed-listing-one';
import { startTestDb, stopTestDb, TestDb } from '../integration/testkit/postgres';
import { createNestApp } from '../e2e/create-app';

describe('MiniBnB pact provider', () => {
    let db: TestDb;
    let app: INestApplication;
    let baseUrl: string;

    beforeAll(async () => {
        db = await startTestDb();
        app = await createNestApp();
        await app.listen(0);
        baseUrl = await app.getUrl();
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

    it('satisfies the consumer contract', async () => {
        const version = process.env.GITHUB_SHA || process.env.GIT_SHA || 'local';
        const broker = process.env.PACT_BROKER_URL;
        const pactUrl = path.resolve(process.cwd(), 'pacts', 'MiniBnBWeb-MiniBnB.json');

        const verifier = new Verifier({
            provider: 'MiniBnB',
            providerBaseUrl: baseUrl,
            providerVersion: version,
            stateHandlers: {
                'listing 1 exists': async () => {
                    await ensureListingOne(app.get(DataSource));
                },
            },
            ...(broker
                ? {
                      pactBrokerUrl: broker,
                      consumerVersionSelectors: [{ latest: true }],
                      publishVerificationResult: true,
                      providerVersionTags: [process.env.GITHUB_REF_NAME || 'local'],
                      ...(process.env.PACT_BROKER_TOKEN
                          ? { pactBrokerToken: process.env.PACT_BROKER_TOKEN }
                          : {}),
                  }
                : { pactUrls: [pactUrl] }),
        });

        await verifier.verifyProvider();
    }, 120_000);
});
