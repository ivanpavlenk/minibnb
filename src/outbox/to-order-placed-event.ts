import { Booking } from '../entities/booking.entity';

export type OrderPlacedEvent = {
    eventId: string;
    type: 'order.placed';
    occurredAt: string;
    data: {
        bookingId: string;
        listingId: string;
    };
};

export function toOrderPlacedEvent(booking: Booking): OrderPlacedEvent {
    return {
        eventId: `booking:${booking.id}:placed`,
        type: 'order.placed',
        occurredAt: new Date().toISOString(),
        data: {
            bookingId: String(booking.id),
            listingId: String(booking.listingId),
        },
    };
}
