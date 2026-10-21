import { Module } from '@nestjs/common';
import { OrderPlacedConsumer } from './order-placed.consumer';
import { OrderPlacedPublisher } from './order-placed.publisher';

@Module({
    providers: [OrderPlacedPublisher, OrderPlacedConsumer],
    exports: [OrderPlacedPublisher],
})
export class BrokerModule {}
