import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { BookingRepository } from './booking.repository';
import { OrderEventsService, OrderStatusEvent } from './order-events.service';

@Controller('orders')
export class OrdersController {
    constructor(
        private readonly bookings: BookingRepository,
        private readonly orderEvents: OrderEventsService,
    ) {}

    @Get(':id/events')
    async events(@Param('id') id: string, @Req() req: Request, @Res() res: Response) {
        const guestId = String(req.headers['x-guest-id'] ?? '');
        if (!guestId) {
            problem(res, req, 403, 'Forbidden', 'anonymous');
            return;
        }

        const booking = await this.bookings.findById(id);
        if (!booking) {
            problem(res, req, 404, 'Not Found', 'Booking not found');
            return;
        }
        if (String(booking.guestId) !== guestId) {
            problem(res, req, 403, 'Forbidden', 'forbidden');
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        });
        res.write('retry: 1000\n\n');

        const lastEventId = Number(req.headers['last-event-id'] ?? 0);
        for (const event of this.orderEvents.eventsAfter(lastEventId, id)) {
            res.write(formatSse(event));
        }

        const sub = this.orderEvents.events$.subscribe((event) => {
            if (event.orderId === id) {
                res.write(formatSse(event));
            }
        });

        req.on('close', () => {
            sub.unsubscribe();
        });
    }
}

function problem(res: Response, req: Request, status: number, title: string, detail: string): void {
    res.status(status).type('application/problem+json').json({
        type: 'about:blank',
        title,
        status,
        detail,
        instance: req.originalUrl,
    });
}

function formatSse(event: OrderStatusEvent): string {
    const data = JSON.stringify({ orderId: event.orderId, status: event.status });
    return `id: ${event.id}\nevent: order.status\ndata: ${data}\n\n`;
}
