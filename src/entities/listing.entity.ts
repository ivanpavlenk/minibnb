import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Booking } from './booking.entity';

@Entity({ name: 'listings' })
export class Listing {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @Column({ type: 'bigint', name: 'owner_id' })
    ownerId!: string;

    @ManyToOne(() => User, (user) => user.listings, { onDelete: 'RESTRICT', nullable: false })
    @JoinColumn({ name: 'owner_id' })
    owner!: User;

    @Column({ type: 'text' })
    title!: string;

    @Column({ type: 'text' })
    city!: string;

    @Column({ type: 'int', name: 'price_per_night' })
    pricePerNight!: number;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;

    @OneToMany(() => Booking, (booking) => booking.listing)
    bookings!: Booking[];
}