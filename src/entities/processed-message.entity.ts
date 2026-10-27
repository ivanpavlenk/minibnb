import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'processed_messages' })
export class ProcessedMessage {
    @PrimaryColumn({ type: 'text', name: 'message_id' })
    messageId!: string;

    @PrimaryColumn({ type: 'text' })
    consumer!: string;

    @CreateDateColumn({ type: 'timestamptz', name: 'processed_at' })
    processedAt!: Date;
}
