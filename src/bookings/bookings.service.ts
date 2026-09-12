import { createHash } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ProblemException } from '../common/problem.exception';
import { Booking, CreateBookingRequest } from '../common/types';
import { MemoryStore } from '../store/memory.store';

@Injectable()
export class BookingsService {
  constructor(private readonly store: MemoryStore) {}

  list(): Booking[] {
    return this.store.bookings;
  }

  getById(bookingId: number): Booking {
    const booking = this.store.bookings.find((row) => row.id === bookingId);
    if (!booking) {
      throw new ProblemException(HttpStatus.NOT_FOUND, 'Not Found', 'Booking not found');
    }
    return booking;
  }

  create(idempotencyKey: string, body: CreateBookingRequest): { booking: Booking; replay: boolean } {
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

    const listing = this.store.listings.find((row) => row.id === body.listing_id);
    if (!listing) {
      throw new ProblemException(HttpStatus.NOT_FOUND, 'Not Found', 'Listing not found');
    }

    const nights = Math.round(
      (new Date(body.check_out).getTime() - new Date(body.check_in).getTime()) / 86400000,
    );
    if (nights < 1) {
      throw new ProblemException(HttpStatus.BAD_REQUEST, 'Invalid dates', 'check_out must be after check_in');
    }

    const booking: Booking = {
      id: this.store.bookings.length + 1,
      listing_id: listing.id,
      check_in: body.check_in,
      check_out: body.check_out,
      guests: body.guests,
      total_cents: listing.price_cents * nights,
      status: 'confirmed',
    };

    this.store.bookings.push(booking);
    this.store.idempotencyKeys.set(idempotencyKey, { hash, booking });
    return { booking, replay: false };
  }
}

function hashBody(body: CreateBookingRequest): string {
  return createHash('sha256').update(JSON.stringify(body)).digest('hex');
}
