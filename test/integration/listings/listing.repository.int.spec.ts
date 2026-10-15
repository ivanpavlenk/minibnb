import { ListingRepository } from '../../../src/listings/listing.repository';
import { UserRepository } from '../../../src/users/user.repository';
import { aListing, aUser } from '../testkit/builders';
import { postgresErrorCode } from '../testkit/pg-error';
import { startTestDb, stopTestDb, truncateAll, TestDb } from '../testkit/postgres';

describe('ListingRepository', () => {
    let db: TestDb;
    let users: UserRepository;
    let listings: ListingRepository;

    beforeAll(async () => {
        db = await startTestDb();
        users = new UserRepository(db.ds);
        listings = new ListingRepository(db.ds);
    }, 120_000);

    afterAll(async () => {
        await stopTestDb(db);
    });

    beforeEach(async () => {
        await truncateAll(db.ds);
    });

    it('saves a listing and finds it by id', async () => {
        const owner = await users.save(aUser({ role: 'host' }));
        const created = await listings.save(aListing(owner.id, { title: 'Kyiv loft', city: 'Kyiv' }));
        const found = await listings.findById(created.id);

        expect(found).not.toBeNull();
        expect(found?.title).toBe('Kyiv loft');
        expect(found?.ownerId).toBe(owner.id);
    });

    it('rejects a listing whose owner does not exist with FK violation 23503', async () => {
        try {
            await listings.save(aListing('999999'));
            fail('expected foreign key violation');
        } catch (error) {
            expect(postgresErrorCode(error)).toBe('23503');
        }
    });

    it('loads the owner through a JOIN and counts listings in a city', async () => {
        const owner = await users.save(aUser({ email: 'host@minibnb.test', role: 'host' }));
        const listing = await listings.save(aListing(owner.id, { city: 'Lviv' }));
        await listings.save(aListing(owner.id, { city: 'Lviv' }));
        await listings.save(aListing(owner.id, { city: 'Odesa' }));

        const withOwner = await listings.findWithOwner(listing.id);
        expect(withOwner?.owner.email).toBe('host@minibnb.test');
        expect(await listings.countByCity('Lviv')).toBe(2);
        expect(await listings.countByCity('Odesa')).toBe(1);
    });
});
