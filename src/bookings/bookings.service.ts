import { createHash } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BookingRepository } from './booking.repository';
import { ProblemException } from '../common/problem.exception';
import { Booking, CreateBookingRequest } from '../common/types';
import { Booking as BookingRow } from '../entities/booking.entity';
import { ListingRepository } from '../listings/listing.repository';
import { toApiListing } from '../listings/listings.service';
import { UserRepository } from '../users/user.repository';
import { OrderEventsService } from './order-events.service';
import { toOrderPlacedEvent } from '../outbox/to-order-placed-event';

@Injectable()
export class BookingsService {
  private readonly guestsByBookingId = new Map<number, number>();

  constructor(
    private readonly ds: DataSource,
    private readonly listings: ListingRepository,
    private readonly bookings: BookingRepository,
    private readonly users: UserRepository,
    private readonly orderEvents: OrderEventsService,
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
    options?: { crashAfterOutbox?: boolean },
  ): Promise<{ booking: Booking; replay: boolean; guestId: string }> {
    const hash = hashBody(body);

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

    try {
      return await this.ds.transaction(async (manager) => {
        const seen: Array<{ booking_id: string; request_hash: string }> = await manager.query(
          `SELECT booking_id, request_hash FROM idempotency_keys WHERE key = $1`,
          [idempotencyKey],
        );
        if (seen[0]) {
          if (seen[0].request_hash !== hash) {
            throw new ProblemException(
              HttpStatus.UNPROCESSABLE_ENTITY,
              'Idempotency key conflict',
              'The same Idempotency-Key was reused with a different request body.',
              'https://minibnb.local/problems/idempotency-key-conflict',
            );
          }
          const existing = await manager.getRepository(BookingRow).findOne({
            where: { id: String(seen[0].booking_id) },
          });
          if (!existing) {
            throw new ProblemException(HttpStatus.NOT_FOUND, 'Not Found', 'Booking not found');
          }
          return {
            booking: this.toApiBooking(existing, body.guests),
            replay: true,
            guestId: guest.id,
          };
        }

        const saved = await manager.getRepository(BookingRow).save(
          manager.getRepository(BookingRow).create({
            listingId: listingRow.id,
            guestId: guest.id,
            checkIn: body.check_in,
            checkOut: body.check_out,
            status: 'confirmed',
            totalAmount: listing.price_cents * nights,
          }),
        );

        const event = toOrderPlacedEvent(saved);
        await manager.query(
          `INSERT INTO outbox (aggregate_type, aggregate_id, type, payload)
           VALUES ($1, $2, $3, $4::jsonb)`,
          ['booking', String(saved.id), event.type, JSON.stringify(event)],
        );
        await manager.query(
          `INSERT INTO idempotency_keys (key, booking_id, request_hash)
           VALUES ($1, $2, $3)`,
          [idempotencyKey, saved.id, hash],
        );

        if (options?.crashAfterOutbox) {
          throw new Error('crash-write');
        }

        return {
          booking: this.toApiBooking(saved, body.guests),
          replay: false,
          guestId: guest.id,
        };
      });
    } catch (err) {
      if (isUniqueViolation(err) && idempotencyKey) {
        const again: Array<{ booking_id: string; request_hash: string }> = await this.ds.query(
          `SELECT booking_id, request_hash FROM idempotency_keys WHERE key = $1`,
          [idempotencyKey],
        );
        if (again[0] && again[0].request_hash === hash) {
          const existing = await this.bookings.findById(String(again[0].booking_id));
          if (existing) {
            return { booking: this.toApiBooking(existing, body.guests), replay: true, guestId: guest.id };
          }
        }
      }
      throw err;
    }
  }

  async updateStatus(bookingId: number, status: 'confirmed' | 'cancelled'): Promise<Booking> {
    const saved = await this.bookings.updateStatus(String(bookingId), status);
    if (!saved) {
      throw new ProblemException(HttpStatus.NOT_FOUND, 'Not Found', 'Booking not found');
    }
    this.orderEvents.emitStatus(String(saved.id), saved.status);
    return this.toApiBooking(saved);
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

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505';
}
