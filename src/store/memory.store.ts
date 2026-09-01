import { Injectable } from '@nestjs/common';
import { Booking, Listing } from '../common/types';

type IdempotencyRecord = {
  hash: string;
  booking: Booking;
};

@Injectable()
export class MemoryStore {
  readonly listings: Listing[] = [
    { id: 1, title: 'Квартира на Подоле', city: 'Kyiv', price_cents: 260000 },
    { id: 2, title: 'Лофт на Рибальському', city: 'Kyiv', price_cents: 310000 },
    { id: 3, title: 'Будинок біля моря', city: 'Odesa', price_cents: 450000 },
    { id: 4, title: 'Студія в центрі', city: 'Lviv', price_cents: 180000 },
    { id: 5, title: 'Шале в Карпатах', city: 'Bukovel', price_cents: 520000 },
  ];

  readonly bookings: Booking[] = [];
  readonly idempotencyKeys = new Map<string, IdempotencyRecord>();
}
