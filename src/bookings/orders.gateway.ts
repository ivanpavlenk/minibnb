import { OnModuleInit } from '@nestjs/common';
import {
    ConnectedSocket,
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { BookingRepository } from './booking.repository';
import { OrderEventsService } from './order-events.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class OrdersGateway implements OnModuleInit {
    @WebSocketServer()
    server!: Server;

    constructor(
        private readonly bookings: BookingRepository,
        private readonly orderEvents: OrderEventsService,
    ) {}

    onModuleInit(): void {
        this.orderEvents.events$.subscribe((event) => {
            this.server.to(`orders:${event.orderId}`).emit('order.status', {
                id: event.id,
                orderId: event.orderId,
                status: event.status,
            });
        });
    }

    @SubscribeMessage('join')
    async handleJoin(
        @ConnectedSocket() socket: Socket,
        @MessageBody() body: { id?: string | number },
    ) {
        const guestId = String(socket.handshake.auth?.guestId ?? '');
        const orderId = String(body?.id ?? '');

        if (!guestId) {
            throw new WsException('anonymous');
        }
        if (!orderId) {
            throw new WsException('order id required');
        }

        const booking = await this.bookings.findById(orderId);
        if (!booking || String(booking.guestId) !== guestId) {
            throw new WsException('forbidden');
        }

        const room = `orders:${orderId}`;
        await socket.join(room);
        return { ok: true, room };
    }
}