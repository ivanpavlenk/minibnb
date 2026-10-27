import { Module } from '@nestjs/common';
import { RedisHttpModule } from '../redis/redis-http.module';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [RedisHttpModule],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
