import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'processed_events' })
export class ProcessedEvent {
    @PrimaryColumn({ type: 'text', name: 'event_id' })
    eventId!: string;

    @CreateDateColumn({ type: 'timestamptz', name: 'processed_at' })
    processedAt!: Date;
}
