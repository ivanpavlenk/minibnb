import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export type OrderStatusEvent = {
    id: number;
    orderId: string;
    status: string;
};

type OrderEventLog = {
    nextId: number;
    buffer: OrderStatusEvent[];
};

const MAX_EVENTS_PER_ORDER = 50;

@Injectable()
export class OrderEventsService {
    private readonly logs = new Map<string, OrderEventLog>();
    private readonly subject = new Subject<OrderStatusEvent>();

    readonly events$ = this.subject.asObservable();

    emitStatus(orderId: string, status: string): OrderStatusEvent {
        const log = this.logFor(orderId);
        const event: OrderStatusEvent = {
            id: log.nextId,
            orderId,
            status,
        };
        log.nextId += 1;
        log.buffer.push(event);
        if (log.buffer.length > MAX_EVENTS_PER_ORDER) {
            log.buffer.shift();
        }
        this.subject.next(event);
        return event;
    }

    eventsAfter(lastEventId: number, orderId: string): OrderStatusEvent[] {
        const log = this.logs.get(orderId);
        if (!log) {
            return [];
        }
        return log.buffer.filter((event) => event.id > lastEventId);
    }

    private logFor(orderId: string): OrderEventLog {
        let log = this.logs.get(orderId);
        if (!log) {
            log = { nextId: 1, buffer: [] };
            this.logs.set(orderId, log);
        }
        return log;
    }
}
