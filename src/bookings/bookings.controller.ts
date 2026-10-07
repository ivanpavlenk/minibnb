import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { CreateBookingRequest } from '../common/types';
import { BookingsService } from './bookings.service';

@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get()
  list() {
    return this.bookings.list();
  }

  @Get(':bookingId')
  getOne(@Param('bookingId', ParseIntPipe) bookingId: number) {
    return this.bookings.getById(bookingId);
  }

  @Post()
  @HttpCode(201)
  async create(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() body: CreateBookingRequest,
  ) {
    const key = String(req.headers['idempotency-key'] ?? '');
    const { booking, replay } = await this.bookings.create(key, body);
    if (replay) {
      res.set('Idempotency-Replay', 'true');
    }
    return booking;
  }
}
