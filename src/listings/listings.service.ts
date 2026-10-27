import { HttpStatus, Injectable } from '@nestjs/common';
import { ProblemException } from '../common/problem.exception';
import { Listing, ListingPage } from '../common/types';
import { Listing as ListingRow } from '../entities/listing.entity';
import { ListingRepository } from './listing.repository';
import { ListingCache } from '../redis/listing-cache';

@Injectable()
export class ListingsService {
  constructor(
    private readonly listings: ListingRepository,
    private readonly cache: ListingCache,
  ) {}

  async list(limit = 20, cursor?: string): Promise<ListingPage> {
    const afterId = cursor ? decodeCursor(cursor) : null;
    const rows = await this.listings.listAfter(afterId, limit + 1);
    const items = rows.slice(0, limit).map(toApiListing);
    const next_cursor = rows.length > limit ? encodeCursor(items[items.length - 1].id) : null;
    return { items, next_cursor };
  }

  async getById(listingId: number): Promise<Listing> {
    const cached = await this.cache.get(listingId);
    if (cached) {
      return cached;
    }
    return this.cache.withSingleFlight(listingId, async () => {
      const again = await this.cache.get(listingId);
      if (again) {
        return again;
      }
      const listing = await this.listings.findById(String(listingId));
      if (!listing) {
        throw new ProblemException(HttpStatus.NOT_FOUND, 'Not Found', 'Listing not found');
      }
      const api = toApiListing(listing);
      await this.cache.set(api);
      return api;
    });
  }
}

export function toApiListing(row: ListingRow): Listing {
  return {
    id: Number(row.id),
    title: row.title,
    city: row.city,
    price_cents: row.pricePerNight,
  };
}

function encodeCursor(id: number): string {
  return Buffer.from(String(id), 'utf8').toString('base64');
}

function decodeCursor(cursor: string): number {
  const id = Number(Buffer.from(cursor, 'base64').toString('utf8'));
  if (!Number.isInteger(id) || id < 1) {
    throw new ProblemException(HttpStatus.BAD_REQUEST, 'Bad Request', 'cursor is not a valid opaque token');
  }
  return id;
}
