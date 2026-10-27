import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'idempotency_keys' })
export class IdempotencyKey {
    @PrimaryColumn({ type: 'text' })
    key!: string;

    @Column({ type: 'bigint', name: 'booking_id' })
    bookingId!: string;

    @Column({ type: 'text', name: 'request_hash' })
    requestHash!: string;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;
}
