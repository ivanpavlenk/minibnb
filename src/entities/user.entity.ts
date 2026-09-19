import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Listing } from './listing.entity';
import { Booking } from './booking.entity';

export type UserRole = 'host' | 'guest';

@Entity({ name: 'users' })
export class User {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @Column({ type: 'text', unique: true })
    email!: string;

    @Column({ type: 'text' })
    role!: UserRole;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;

    @OneToMany(() => Listing, (listing) => listing.owner)
    listings!: Listing[];

    @OneToMany(() => Booking, (booking) => booking.guest)
    bookings!: Booking[];

    @Column({ type: "int", name: "balance_cents", default: 0 })
    balanceCents!: number;
}