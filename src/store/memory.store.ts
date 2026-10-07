import { Injectable } from '@nestjs/common';
import { Booking } from '../common/types';

type IdempotencyRecord = {
  hash: string;
  booking: Booking;
};

@Injectable()
export class MemoryStore {
  readonly idempotencyKeys = new Map<string, IdempotencyRecord>();
}
