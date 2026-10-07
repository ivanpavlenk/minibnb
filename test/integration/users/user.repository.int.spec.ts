import { UserRepository } from '../../../src/users/user.repository';
import { aUser } from '../testkit/builders';
import { postgresErrorCode } from '../testkit/pg-error';
import { startTestDb, stopTestDb, truncateAll, TestDb } from '../testkit/postgres';

describe('UserRepository', () => {
    let db: TestDb;
    let users: UserRepository;

    beforeAll(async () => {
        db = await startTestDb();
        users = new UserRepository(db.ds);
    }, 120_000);

    afterAll(async () => {
        await stopTestDb(db);
    });

    beforeEach(async () => {
        await truncateAll(db.ds);
    });

    it('saves a user and finds them by email', async () => {
        const created = await users.save(aUser({ email: 'anna@minibnb.test', role: 'host' }));
        const found = await users.findByEmail('anna@minibnb.test');

        expect(found).not.toBeNull();
        expect(found?.id).toBe(created.id);
        expect(found?.role).toBe('host');
    });

    it('rejects a duplicate email with unique violation 23505', async () => {
        await users.save(aUser({ email: 'dup@minibnb.test' }));

        try {
            await users.save(aUser({ email: 'dup@minibnb.test' }));
            fail('expected unique violation');
        } catch (error) {
            expect(postgresErrorCode(error)).toBe('23505');
        }
    });

    it('upserts by email with ON CONFLICT and updates the role', async () => {
        const first = await users.upsertByEmail(aUser({ email: 'kira@minibnb.test', role: 'guest' }));
        const second = await users.upsertByEmail(aUser({ email: 'kira@minibnb.test', role: 'host' }));

        expect(second.id).toBe(first.id);
        expect(second.role).toBe('host');
        expect((await users.findByEmail('kira@minibnb.test'))?.role).toBe('host');
    });
});
