import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { OrderPlacedPublisher } from '../broker/order-placed.publisher';
import { Env } from '../config/env.schema';
import { OrderPlacedEvent } from './to-order-placed-event';

const DRAIN_LIMIT = 10;

@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(OutboxRelay.name);
    private timer: NodeJS.Timeout | null = null;

    constructor(
        private readonly ds: DataSource,
        private readonly publisher: OrderPlacedPublisher,
        private readonly config: ConfigService<Env, true>,
    ) {}

    onModuleInit(): void {
        if (!this.config.get('BROKER_URL', { infer: true })) {
            return;
        }
        this.timer = setInterval(() => {
            void this.drain().catch((err) => this.log.warn(String(err)));
        }, 1000);
    }

    onModuleDestroy(): void {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }

    async drain(limit = DRAIN_LIMIT): Promise<number> {
        let published = 0;
        while (published < limit) {
            const did = await this.publishOne();
            if (!did) {
                break;
            }
            published += 1;
        }
        return published;
    }

    private async publishOne(): Promise<boolean> {
        return this.ds.transaction(async (manager) => {
            const rows: Array<{ id: string; payload: OrderPlacedEvent }> = await manager.query(
                `SELECT id, payload
                 FROM outbox
                 WHERE published_at IS NULL
                 ORDER BY created_at, id
                 FOR UPDATE SKIP LOCKED
                 LIMIT 1`,
            );
            const row = rows[0];
            if (!row) {
                return false;
            }
            await this.publisher.publish(row.payload);
            await manager.query(
                `UPDATE outbox
                 SET published_at = now(), attempts = attempts + 1
                 WHERE id = $1`,
                [row.id],
            );
            return true;
        });
    }
}
