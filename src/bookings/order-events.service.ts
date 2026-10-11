import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type OrderStatusEvent = {
    id: number;
    orderId: string;
    status: string;
};

@Injectable()
export class OrderEventsService {
    private nextId = 1;
    private readonly buffer: OrderStatusEvent[] = [];
    private readonly subject = new Subject<OrderStatusEvent>();

    readonly events$ = this.subject.asObservable();

    emitStatus(orderId: string, status: string): OrderStatusEvent {
        const event: OrderStatusEvent = {
            id: this.nextId,
            orderId,
            status,
        };
        this.nextId += 1;
        this.buffer.push(event);
        this.subject.next(event);
        return event;
    }

    eventsAfter(lastEventId: number, orderId: string): OrderStatusEvent[] {
        return this.buffer.filter((event) => event.orderId === orderId && event.id > lastEventId);
    }
}