import { AppDataSource } from "./data-source";
import { Booking } from "./entities/booking.entity";
import { Job } from "./entities/job.entity";

export class CheckoutError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CheckoutError";
    }
}

export async function checkout(
    listingId: string,
    guestId: string,
    qty = 1,
): Promise<{ bookingId: string; jobId: string }> {
    return AppDataSource.transaction(async (manager) => {
        // TypeORM UPDATE returns [rows, affectedCount], not just rows
        const listingRaw = (await manager.query(
            `UPDATE listings
             SET stock = stock - $1
             WHERE id = $2 AND stock >= $1
             RETURNING id, price_per_night, stock`,
            [qty, listingId],
        )) as [Array<{ id: string; price_per_night: number; stock: number }>, number];
        const listingRows = listingRaw[0];

        if (listingRows.length === 0) {
            throw new CheckoutError("no beds");
        }

        const price = Number(listingRows[0].price_per_night) * qty;
        if (!Number.isFinite(price)) {
            throw new CheckoutError("no beds");
        }

        const guestRaw = (await manager.query(
            `UPDATE users
             SET balance_cents = balance_cents - $1
             WHERE id = $2 AND balance_cents >= $1
             RETURNING id`,
            [price, guestId],
        )) as [Array<{ id: string }>, number];
        const guestRows = guestRaw[0];

        if (guestRows.length === 0) {
            throw new CheckoutError("no money");
        }

        const booking = await manager.getRepository(Booking).save(
            manager.getRepository(Booking).create({
                listingId,
                guestId,
                checkIn: "2026-10-01",
                checkOut: "2026-10-02",
                status: "confirmed",
                totalAmount: price,
            }),
        );

        const job = await manager.getRepository(Job).save(
            manager.getRepository(Job).create({
                type: "send_booking_email",
                payload: { bookingId: booking.id },
                status: "pending",
                processed: 0,
                workerId: null,
            }),
        );

        return { bookingId: booking.id, jobId: job.id };
    });
}