import { NewUser } from '../../../src/users/user.repository';
import { NewListing } from '../../../src/listings/listing.repository';
import { UserRole } from '../../../src/entities/user.entity';

let seq = 0;

export function aUser(overrides: Partial<NewUser> = {}): NewUser {
    seq += 1;
    return {
        email: `user${seq}@minibnb.test`,
        role: 'guest' satisfies UserRole,
        balanceCents: 0,
        ...overrides,
    };
}

export function aListing(ownerId: string, overrides: Partial<NewListing> = {}): NewListing {
    seq += 1;
    return {
        ownerId,
        title: `Listing ${seq}`,
        city: 'Kyiv',
        pricePerNight: 10000,
        stock: 1,
        ...overrides,
    };
}
