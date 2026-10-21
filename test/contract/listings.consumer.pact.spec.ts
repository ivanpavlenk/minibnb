import path from 'node:path';
import { PactV3, MatchersV3, SpecificationVersion } from '@pact-foundation/pact';

const { integer, string, regex } = MatchersV3;

const provider = new PactV3({
    consumer: 'MiniBnBWeb',
    provider: 'MiniBnB',
    dir: path.resolve(process.cwd(), 'pacts'),
    spec: SpecificationVersion.SPECIFICATION_VERSION_V3,
});

describe('MiniBnBWeb pact with MiniBnB', () => {
    it('gets listing 1', async () => {
        provider
            .given('listing 1 exists')
            .uponReceiving('GET /listings/1')
            .withRequest({
                method: 'GET',
                path: '/listings/1',
            })
            .willRespondWith({
                status: 200,
                headers: {
                    'Content-Type': regex('^application/json(;.*)?$', 'application/json; charset=utf-8'),
                },
                body: {
                    id: integer(1),
                    title: string('Квартира на Подоле'),
                    city: string('Kyiv'),
                    price_cents: integer(260000),
                },
            });

        await provider.executeTest(async (mockServer) => {
            const response = await fetch(`${mockServer.url}/listings/1`);
            expect(response.status).toBe(200);
            const body = (await response.json()) as {
                id: number;
                title: string;
                city: string;
                price_cents: number;
            };
            expect(body).toEqual({
                id: 1,
                title: 'Квартира на Подоле',
                city: 'Kyiv',
                price_cents: 260000,
            });
        });
    });
});
