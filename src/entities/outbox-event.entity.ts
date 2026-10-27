import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'outbox' })
export class OutboxEvent {
    @PrimaryGeneratedColumn({ type: 'bigint' })
    id!: string;

    @Column({ type: 'text', name: 'aggregate_type' })
    aggregateType!: string;

    @Column({ type: 'text', name: 'aggregate_id' })
    aggregateId!: string;

    @Column({ type: 'text' })
    type!: string;

    @Column({ type: 'jsonb' })
    payload!: Record<string, unknown>;

    @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
    createdAt!: Date;

    @Column({ type: 'timestamptz', name: 'published_at', nullable: true })
    publishedAt!: Date | null;

    @Column({ type: 'int', default: 0 })
    attempts!: number;
}
