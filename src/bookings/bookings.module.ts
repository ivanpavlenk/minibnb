import {Module} from '@nestjs/common';
import {BookingsController} from './bookings.controller';
import {BookingsService} from './bookings.service';
import {OrderEventsService} from "./order-events.service";
import {OrdersGateway} from "./orders.gateway";
import {OrdersController} from "./orders.controller";

@Module({
    controllers: [BookingsController, OrdersController],
    providers: [BookingsService, OrderEventsService, OrdersGateway],
    exports: [OrderEventsService],
})
export class BookingsModule {
}
