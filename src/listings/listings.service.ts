import { HttpStatus, Injectable } from '@nestjs/common';
import { ProblemException } from '../common/problem.exception';
import { Listing, ListingPage } from '../common/types';
import { MemoryStore } from '../store/memory.store';

@Injectable()
export class ListingsService {
  constructor(private readonly store: MemoryStore) {}

  list(limit = 20, cursor?: string): ListingPage {
    let rows = this.store.listings.slice().sort((a, b) => a.id - b.id);
    if (cursor) {
      const afterId = decodeCursor(cursor);
      rows = rows.filter((row) => row.id > afterId);
    }
    const items = rows.slice(0, limit);
    const next_cursor = rows.length > limit ? encodeCursor(items[items.length - 1].id) : null;
    return { items, next_cursor };
  }

  getById(listingId: number): Listing {
    const listing = this.store.listings.find((row) => row.id === listingId);
    if (!listing) {
      throw new ProblemException(HttpStatus.NOT_FOUND, 'Not Found', 'Listing not found');
    }
    return listing;
  }
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
