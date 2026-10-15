import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ListingsService } from './listings.service';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  list(@Query('limit') limit?: string, @Query('cursor') cursor?: string) {
    return this.listings.list(limit === undefined ? 20 : Number(limit), cursor);
  }

  @Get(':listingId')
  getOne(@Param('listingId', ParseIntPipe) listingId: number) {
    return this.listings.getById(listingId);
  }
}
