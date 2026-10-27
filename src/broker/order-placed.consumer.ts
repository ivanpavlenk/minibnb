import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { DataSource } from 'typeorm';
import { Env } from '../config/env.schema';
import { assertShopTopology } from './assert-topology';
import { PREFETCH, WORK_QUEUE } from './broker.constants';
import { OrderPlacedEvent } from '../outbox/to-order-placed-event';

const CONSUMER = 'order-placed';

@Injectable()
export class OrderPlacedConsumer implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(OrderPlacedConsumer.name);
    private conn: ChannelModel | null = null;
    private ch: Channel | null = null;

    constructor(
        private readonly config: ConfigService<Env, true>,
        private readonly ds: DataSource,
    ) {}

    async onModuleInit(): Promise<void> {
        const url = this.config.get('BROKER_URL', { infer: true });
        if (!url) {
            return;
        }
        this.conn = await amqp.connect(url);
        this.ch = await this.conn.createChannel();
        await assertShopTopology(this.ch);
        await this.ch.prefetch(PREFETCH);
        await this.ch.consume(WORK_QUEUE, (msg) => void this.onMessage(msg), { noAck: false });
    }

    private async onMessage(msg: ConsumeMessage | null): Promise<void> {
        if (!msg || !this.ch) {
            return;
        }
        try {
            const event = JSON.parse(msg.content.toString()) as OrderPlacedEvent;
            if (!event.eventId || !event.data?.bookingId) {
                this.ch.reject(msg, false);
                return;
            }
            await this.ds.transaction(async (manager) => {
                await manager.query(
                    `INSERT INTO processed_messages (message_id, consumer)
                     VALUES ($1, $2)
                     ON CONFLICT (message_id, consumer) DO NOTHING`,
                    [event.eventId, CONSUMER],
                );
                await manager.query(
                    `INSERT INTO order_placed_effects (booking_id)
                     VALUES ($1)
                     ON CONFLICT (booking_id) DO NOTHING`,
                    [String(event.data.bookingId)],
                );
            });
            this.ch.ack(msg);
        } catch (err) {
            this.log.warn(`reject ${String(err)}`);
            this.ch.reject(msg, false);
        }
    }

    async onModuleDestroy(): Promise<void> {
        await this.ch?.close().catch(() => undefined);
        await this.conn?.close().catch(() => undefined);
    }
}
