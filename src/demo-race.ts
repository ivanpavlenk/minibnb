import { AppDataSource } from "./data-source";
import { User } from "./entities/user.entity";
import { Listing } from "./entities/listing.entity";
import { checkout, CheckoutError } from "./checkout";

const ATTEMPTS = 50;
const BEDS = 10;
const QTY = 1;

async function main(): Promise<void> {
    AppDataSource.setOptions({ poolSize: 60 });
    await AppDataSource.initialize();

    const users = AppDataSource.getRepository(User);
    const listings = AppDataSource.getRepository(Listing);

    const host =
        (await users.findOne({ where: { email: "race.host@minibnb.test" } })) ??
        (await users.save(
            users.create({
                email: "race.host@minibnb.test",
                role: "host",
                balanceCents: 0,
            }),
        ));

    let hostel = await listings.findOne({ where: { title: "Kyiv race hostel" } });
    if (!hostel) {
        hostel = await listings.save(
            listings.create({
                owner: host,
                title: "Kyiv race hostel",
                city: "Kyiv",
                pricePerNight: 10000,
                stock: BEDS,
            }),
        );
    }

    await listings.update({ id: hostel.id }, { stock: BEDS });

    const guests: User[] = [];
    for (let i = 0; i < ATTEMPTS; i += 1) {
        const email = `race.guest.${i}@minibnb.test`;
        const existing = await users.findOne({ where: { email } });
        if (existing) {
            existing.balanceCents = 1_000_000_000;
            guests.push(await users.save(existing));
        } else {
            guests.push(
                await users.save(
                    users.create({
                        email,
                        role: "guest",
                        balanceCents: 1_000_000_000,
                    }),
                ),
            );
        }
    }

    const results = await Promise.all(
        guests.map((guest) =>
            checkout(hostel.id, guest.id, QTY)
                .then(() => "ok" as const)
                .catch((err: unknown) => {
                    if (err instanceof CheckoutError) {
                        return "fail" as const;
                    }
                    throw err;
                }),
        ),
    );

    const successful = results.filter((r) => r === "ok").length;

    const row: { stock: number }[] = await AppDataSource.query(
        `SELECT stock FROM listings WHERE id = $1`,
        [hostel.id],
    );
    const finalStock = Number(row[0].stock);

    const neg: { count: string }[] = await AppDataSource.query(
        `SELECT count(*)::text AS count FROM listings WHERE stock < 0`,
    );
    const negativeStockRows = Number(neg[0].count);

    console.log(`attempts: ${ATTEMPTS}`);
    console.log(`successful: ${successful}`);
    console.log(`final stock: ${finalStock}`);
    console.log(`negative stock rows: ${negativeStockRows}`);

    await AppDataSource.destroy();

    const expected = BEDS / QTY;
    if (successful !== expected || finalStock !== 0 || negativeStockRows !== 0) {
        console.error("oversell invariant failed");
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});