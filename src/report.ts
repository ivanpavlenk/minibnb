import { AppDataSource } from "./data-source";
import { Booking } from "./entities/booking.entity";

async function main(): Promise<void> {
    await AppDataSource.initialize();

    const rows = await AppDataSource.getRepository(Booking)
        .createQueryBuilder("booking")
        .innerJoin("booking.listing", "listing")
        .select("listing.city", "city")
        .addSelect("COUNT(booking.id)", "bookings_count")
        .addSelect("SUM(booking.total_amount)", "revenue_cents")
        .where("booking.status = :status", { status: "confirmed" })
        .groupBy("listing.city")
        .orderBy("SUM(booking.total_amount)", "DESC")
        .getRawMany<{ city: string; bookings_count: string; revenue_cents: string }>();

    console.log("Revenue by city (confirmed bookings, cents):");
    console.table(rows);

    await AppDataSource.destroy();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});