import { Module } from '@nestjs/common';
import { OutboxRelay } from '../outbox/outbox.relay';
import { OrderPlacedConsumer } from './order-placed.consumer';
import { OrderPlacedPublisher } from './order-placed.publisher';

@Module({
    providers: [OrderPlacedPublisher, OrderPlacedConsumer, OutboxRelay],
    exports: [OrderPlacedPublisher, OutboxRelay],
})
export class BrokerModule {}
