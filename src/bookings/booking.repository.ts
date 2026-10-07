import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking, BookingStatus } from '../entities/booking.entity';

export type NewBooking = {
    listingId: string;
    guestId: string;
    checkIn: string;
    checkOut: string;
    status: BookingStatus;
    totalAmount: number;
};

@Injectable()
export class BookingRepository {
    constructor(private readonly dataSource: DataSource) {}

    async save(input: NewBooking): Promise<Booking> {
        const repo = this.dataSource.getRepository(Booking);
        return repo.save(
            repo.create({
                listingId: input.listingId,
                guestId: input.guestId,
                checkIn: input.checkIn,
                checkOut: input.checkOut,
                status: input.status,
                totalAmount: input.totalAmount,
            }),
        );
    }

    async findById(id: string): Promise<Booking | null> {
        return this.dataSource.getRepository(Booking).findOne({ where: { id } });
    }

    async findAll(): Promise<Booking[]> {
        return this.dataSource.getRepository(Booking).find({ order: { id: 'ASC' } });
    }
}
