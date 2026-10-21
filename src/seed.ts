import { AppDataSource } from "./data-source";
import { User } from "./entities/user.entity";
import { Listing } from "./entities/listing.entity";
import { Booking } from "./entities/booking.entity";
import { Review } from "./entities/review.entity";
import type { UserRole } from "./entities/user.entity";
import type { BookingStatus } from "./entities/booking.entity";

async function getOrCreateUser(email: string, role: UserRole): Promise<User> {
    const repo = AppDataSource.getRepository(User);
    const existing = await repo.findOne({ where: { email } });
    if (existing) {
        return existing;
    }
    return repo.save(repo.create({ email, role }));
}

async function getOrCreateListing(
    owner: User,
    title: string,
    city: string,
    pricePerNight: number,
): Promise<Listing> {
    const repo = AppDataSource.getRepository(Listing);
    const existing = await repo.findOne({ where: { title } });
    if (existing) {
        return existing;
    }
    return repo.save(repo.create({ owner, title, city, pricePerNight }));
}

async function getOrCreateBooking(
    listing: Listing,
    guest: User,
    checkIn: string,
    checkOut: string,
    status: BookingStatus,
    totalAmount: number,
): Promise<Booking> {
    const repo = AppDataSource.getRepository(Booking);
    const existing = await repo.findOne({
        where: { listingId: listing.id, guestId: guest.id, checkIn },
    });
    if (existing) {
        return existing;
    }
    return repo.save(
        repo.create({ listing, guest, checkIn, checkOut, status, totalAmount }),
    );
}

async function getOrCreateReview(
    booking: Booking,
    rating: number,
    body: string,
): Promise<Review> {
    const repo = AppDataSource.getRepository(Review);
    const existing = await repo.findOne({ where: { bookingId: booking.id } });
    if (existing) {
        return existing;
    }
    return repo.save(repo.create({ booking, rating, body }));
}

async function main(): Promise<void> {
    await AppDataSource.initialize();

    const anna = await getOrCreateUser("anna.host@minibnb.test", "host");
    const bohdan = await getOrCreateUser("bohdan.host@minibnb.test", "host");
    const olena = await getOrCreateUser("olena.host@minibnb.test", "host");
    const taras = await getOrCreateUser("taras.host@minibnb.test", "host");

    const kira = await getOrCreateUser("kira.guest@minibnb.test", "guest");
    const maksym = await getOrCreateUser("maksym.guest@minibnb.test", "guest");
    const sofia = await getOrCreateUser("sofia.guest@minibnb.test", "guest");
    const nazar = await getOrCreateUser("nazar.guest@minibnb.test", "guest");
    const iryna = await getOrCreateUser("iryna.guest@minibnb.test", "guest");
    const petro = await getOrCreateUser("petro.guest@minibnb.test", "guest");

    const kyivLoft = await getOrCreateListing(anna, "Kyiv loft", "Kyiv", 250000);
    const lvivBrick = await getOrCreateListing(anna, "Lviv brick studio", "Lviv", 180000);
    const odesaSea = await getOrCreateListing(bohdan, "Odesa sea view", "Odesa", 320000);
    const kharkivFlat = await getOrCreateListing(bohdan, "Kharkiv center flat", "Kharkiv", 150000);
    const uzhCabin = await getOrCreateListing(olena, "Uzhhorod cabin", "Uzhhorod", 140000);
    const dniproRiver = await getOrCreateListing(olena, "Dnipro river loft", "Dnipro", 210000);
    const ternopilHouse = await getOrCreateListing(taras, "Ternopil house", "Ternopil", 120000);
    const chernivtsiRoom = await getOrCreateListing(taras, "Chernivtsi old town", "Chernivtsi", 110000);

    const b1 = await getOrCreateBooking(kyivLoft, kira, "2026-10-01", "2026-10-05", "confirmed", 1000000);
    const b2 = await getOrCreateBooking(lvivBrick, maksym, "2026-10-10", "2026-10-12", "confirmed", 360000);
    const b3 = await getOrCreateBooking(odesaSea, sofia, "2026-11-01", "2026-11-08", "requested", 2240000);
    const b4 = await getOrCreateBooking(kharkivFlat, nazar, "2026-09-01", "2026-09-03", "cancelled", 300000);
    const b5 = await getOrCreateBooking(uzhCabin, iryna, "2026-12-20", "2026-12-27", "confirmed", 980000);
    const b6 = await getOrCreateBooking(dniproRiver, petro, "2026-10-15", "2026-10-18", "confirmed", 630000);
    const b7 = await getOrCreateBooking(ternopilHouse, kira, "2026-11-10", "2026-11-13", "requested", 360000);
    const b8 = await getOrCreateBooking(chernivtsiRoom, maksym, "2026-08-01", "2026-08-04", "confirmed", 330000);

    await getOrCreateReview(b1, 5, "Quiet loft, great location.");
    await getOrCreateReview(b2, 4, "Nice studio, a bit noisy at night.");
    await getOrCreateReview(b5, 5, "Cabin was perfect for a winter week.");
    await getOrCreateReview(b6, 3, "Okay stay, kitchen could be better.");
    await getOrCreateReview(b8, 4, "Old town is beautiful.");

    const [users, listings, bookings, reviews] = await Promise.all([
        AppDataSource.getRepository(User).count(),
        AppDataSource.getRepository(Listing).count(),
        AppDataSource.getRepository(Booking).count(),
        AppDataSource.getRepository(Review).count(),
    ]);

    console.log(`seed ok: users=${users} listings=${listings} bookings=${bookings} reviews=${reviews}`);

    await AppDataSource.destroy();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});