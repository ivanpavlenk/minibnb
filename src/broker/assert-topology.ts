import type { Channel } from 'amqplib';
import { DLQ, DLX, EVENTS_EXCHANGE, ROUTING_KEY, WORK_QUEUE } from './broker.constants';

export async function assertShopTopology(ch: Channel): Promise<void> {
    await ch.assertExchange(DLX, 'fanout', { durable: true });
    await ch.assertQueue(DLQ, {
        durable: true,
        arguments: { 'x-queue-type': 'quorum' },
    });
    await ch.bindQueue(DLQ, DLX, '');

    await ch.assertExchange(EVENTS_EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(WORK_QUEUE, {
        durable: true,
        arguments: {
            'x-queue-type': 'quorum',
            'x-dead-letter-exchange': DLX,
        },
    });
    await ch.bindQueue(WORK_QUEUE, EVENTS_EXCHANGE, ROUTING_KEY);
}
