import { createHash } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { BookingRepository } from './booking.repository';
import { ProblemException } from '../common/problem.exception';
import { Booking, CreateBookingRequest } from '../common/types';
import { Booking as BookingRow } from '../entities/booking.entity';
import { ListingRepository } from '../listings/listing.repository';
import { toApiListing } from '../listings/listings.service';
import { MemoryStore } from '../store/memory.store';
import { UserRepository } from '../users/user.repository';

@Injectable()
export class BookingsService {
  private readonly guestsByBookingId = new Map<number, number>();

  constructor(
    private readonly store: MemoryStore,
    private readonly listings: ListingRepository,
    private readonly bookings: BookingRepository,
    private readonly users: UserRepository,
  ) {}

  async list(): Promise<Booking[]> {
    const rows = await this.bookings.findAll();
    return rows.map((row) => this.toApiBooking(row));
  }

  async getById(bookingId: number): Promise<Booking> {
    const row = await this.bookings.findById(String(bookingId));
    if (!row) {
      throw new ProblemException(HttpStatus.NOT_FOUND, 'Not Found', 'Booking not found');
    }
    return this.toApiBooking(row);
  }

  async create(
    idempotencyKey: string,
    body: CreateBookingRequest,
  ): Promise<{ booking: Booking; replay: boolean }> {
    const hash = hashBody(body);
    const seen = this.store.idempotencyKeys.get(idempotencyKey);

    if (seen) {
      if (seen.hash !== hash) {
        throw new ProblemException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'Idempotency key conflict',
          'The same Idempotency-Key was reused with a different request body.',
          'https://minibnb.local/problems/idempotency-key-conflict',
        );
      }
      return { booking: seen.booking, replay: true };
    }

    const listingRow = await this.listings.findById(String(body.listing_id));
    if (!listingRow) {
      throw new ProblemException(HttpStatus.NOT_FOUND, 'Not Found', 'Listing not found');
    }
    const listing = toApiListing(listingRow);

    const nights = Math.round(
      (new Date(body.check_out).getTime() - new Date(body.check_in).getTime()) / 86400000,
    );
    if (nights < 1) {
      throw new ProblemException(HttpStatus.BAD_REQUEST, 'Invalid dates', 'check_out must be after check_in');
    }

    const guest = await this.users.upsertByEmail({
      email: 'guest@minibnb.test',
      role: 'guest',
    });

    const saved = await this.bookings.save({
      listingId: listingRow.id,
      guestId: guest.id,
      checkIn: body.check_in,
      checkOut: body.check_out,
      status: 'confirmed',
      totalAmount: listing.price_cents * nights,
    });

    const booking = this.toApiBooking(saved, body.guests);
    this.store.idempotencyKeys.set(idempotencyKey, { hash, booking });
    return { booking, replay: false };
  }

  private toApiBooking(row: BookingRow, guests?: number): Booking {
    const id = Number(row.id);
    if (guests !== undefined) {
      this.guestsByBookingId.set(id, guests);
    }
    const status = row.status === 'cancelled' ? 'cancelled' : 'confirmed';
    return {
      id,
      listing_id: Number(row.listingId),
      check_in: asDateString(row.checkIn),
      check_out: asDateString(row.checkOut),
      guests: this.guestsByBookingId.get(id) ?? 1,
      total_cents: row.totalAmount,
      status,
    };
  }
}

function asDateString(value: string | Date): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashBody(body: CreateBookingRequest): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}
