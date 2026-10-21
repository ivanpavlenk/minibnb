import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    OneToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity({ name: 'reviews' })
@Check(`"rating" BETWEEN 1 AND 5`)
export class Review {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @Column({ type: 'bigint', name: 'booking_id', unique: true })
    bookingId!: string;

    @OneToOne(() => Booking, (booking) => booking.review, { onDelete: 'CASCADE', nullable: false })
    @JoinColumn({ name: 'booking_id' })
    booking!: Booking;

    @Column({ type: 'int' })
    rating!: number;

    @Column({ type: 'text', nullable: true })
    body!: string | null;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;
}