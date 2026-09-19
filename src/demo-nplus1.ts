import { AppDataSource } from "./data-source";
import { Booking } from "./entities/booking.entity";
import { Listing } from "./entities/listing.entity";
import { User } from "./entities/user.entity";
import type { Logger } from "typeorm";

class QueryCountLogger implements Logger {
    count = 0;

    reset(): void {
        this.count = 0;
    }

    logQuery(query: string): void {
        this.count += 1;
        console.log(`SQL[${this.count}] ${query}`);
    }

    logQueryError(): void {}
    logQuerySlow(): void {}
    logSchemaBuild(): void {}
    logMigration(): void {}
    log(): void {}
}

async function main(): Promise<void> {
    const logger = new QueryCountLogger();

    AppDataSource.setOptions({
        logging: ["query"],
        logger,
    });

    await AppDataSource.initialize();

    const bookingsRepo = AppDataSource.getRepository(Booking);
    const listingsRepo = AppDataSource.getRepository(Listing);
    const usersRepo = AppDataSource.getRepository(User);

    // --- наивно: 1 SELECT броней + в цикле listing и owner ---
    logger.reset();
    const bookings = await bookingsRepo.find();
    for (const booking of bookings) {
        const listing = await listingsRepo.findOneByOrFail({ id: booking.listingId });
        await usersRepo.findOneByOrFail({ id: listing.ownerId });
    }
    const naiveCount = logger.count;
    const n = bookings.length;

    logger.reset();
    const withRelations = await bookingsRepo.find({
        relations: {
            listing: {
                owner: true,
            },
        },
    });
    const fixedCount = logger.count;

    console.log("--- N+1 ---");
    console.log(`N (bookings) = ${n}`);
    console.log(`naive (loop) queries = ${naiveCount}`);
    console.log(`relations / join queries = ${fixedCount}`);
    console.log(`loaded with join: ${withRelations.length}`);

    await AppDataSource.destroy();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});