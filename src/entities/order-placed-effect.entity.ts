import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'order_placed_effects' })
export class OrderPlacedEffect {
    @PrimaryColumn({ type: 'text', name: 'booking_id' })
    bookingId!: string;

    @CreateDateColumn({ type: 'timestamptz', name: 'applied_at' })
    appliedAt!: Date;
}
