import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp, { ChannelModel, ConfirmChannel } from 'amqplib';
import { Env } from '../config/env.schema';
import { EVENTS_EXCHANGE, ROUTING_KEY } from './broker.constants';

export type OrderPlacedEvent = {
    eventId: string;
    type: 'order.placed';
    occurredAt: string;
    data: {
        bookingId: string;
        listingId: string;
    };
};

@Injectable()
export class OrderPlacedPublisher implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(OrderPlacedPublisher.name);
    private conn: ChannelModel | null = null;
    private ch: ConfirmChannel | null = null;

    constructor(private readonly config: ConfigService<Env, true>) {}

    async onModuleInit(): Promise<void> {
        const url = this.config.get('BROKER_URL', { infer: true });
        if (!url) {
            return;
        }
        this.conn = await amqp.connect(url);
        this.ch = await this.conn.createConfirmChannel();
    }

    async publish(event: OrderPlacedEvent): Promise<void> {
        if (!this.ch) {
            return;
        }
        this.ch.publish(EVENTS_EXCHANGE, ROUTING_KEY, Buffer.from(JSON.stringify(event)), {
            persistent: true,
            contentType: 'application/json',
            messageId: event.eventId,
            mandatory: true,
        });
        await this.ch.waitForConfirms();
        this.log.debug(`published ${event.eventId}`);
    }

    async onModuleDestroy(): Promise<void> {
        await this.ch?.close().catch(() => undefined);
        await this.conn?.close().catch(() => undefined);
    }
}
