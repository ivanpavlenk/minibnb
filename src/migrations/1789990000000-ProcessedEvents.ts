import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProcessedEvents1789990000000 implements MigrationInterface {
    name = 'ProcessedEvents1789990000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "processed_events" (
                "event_id" text NOT NULL,
                "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_processed_events" PRIMARY KEY ("event_id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "processed_events"`);
    }
}
