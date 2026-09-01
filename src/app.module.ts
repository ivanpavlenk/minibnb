import { Module } from '@nestjs/common';
import { BookingsModule } from './bookings/bookings.module';
import { ListingsModule } from './listings/listings.module';
import { StoreModule } from './store/store.module';

@Module({
  imports: [StoreModule, ListingsModule, BookingsModule],
})
export class AppModule {}
