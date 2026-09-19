import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { Listing } from './listing.entity';
import { User } from './user.entity';
import { Review } from './review.entity';

export type BookingStatus = 'requested' | 'confirmed' | 'cancelled';

@Entity({ name: 'bookings' })
@Check(`"check_out" > "check_in"`)
export class Booking {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @Column({ type: 'bigint', name: 'listing_id' })
    listingId!: string;

    @ManyToOne(() => Listing, (listing) => listing.bookings, { onDelete: 'RESTRICT', nullable: false })
    @JoinColumn({ name: 'listing_id' })
    listing!: Listing;

    @Column({ type: 'bigint', name: 'guest_id' })
    guestId!: string;

    @ManyToOne(() => User, (user) => user.bookings, { onDelete: 'RESTRICT', nullable: false })
    @JoinColumn({ name: 'guest_id' })
    guest!: User;

    @Column({ type: 'date', name: 'check_in' })
    checkIn!: string;

    @Column({ type: 'date', name: 'check_out' })
    checkOut!: string;

    @Column({ type: 'text' })
    status!: BookingStatus;

    @Column({ type: 'int', name: 'total_amount' })
    totalAmount!: number;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;

    @OneToOne(() => Review, (review) => review.booking)
    review!: Review | null;
}