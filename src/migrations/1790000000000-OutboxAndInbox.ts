import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutboxAndInbox1790000000000 implements MigrationInterface {
    name = 'OutboxAndInbox1790000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "outbox" (
                "id" BIGSERIAL NOT NULL,
                "aggregate_type" text NOT NULL,
                "aggregate_id" text NOT NULL,
                "type" text NOT NULL,
                "payload" jsonb NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "published_at" TIMESTAMP WITH TIME ZONE,
                "attempts" integer NOT NULL DEFAULT 0,
                CONSTRAINT "PK_outbox" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "IDX_outbox_unpublished" ON "outbox" ("created_at", "id") WHERE "published_at" IS NULL`,
        );
        await queryRunner.query(`
            CREATE TABLE "processed_messages" (
                "message_id" text NOT NULL,
                "consumer" text NOT NULL,
                "processed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_processed_messages" PRIMARY KEY ("message_id", "consumer")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "idempotency_keys" (
                "key" text NOT NULL,
                "booking_id" bigint NOT NULL,
                "request_hash" text NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_idempotency_keys" PRIMARY KEY ("key")
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "order_placed_effects" (
                "booking_id" text NOT NULL,
                "applied_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_order_placed_effects" PRIMARY KEY ("booking_id")
            )
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "order_placed_effects"`);
        await queryRunner.query(`DROP TABLE "idempotency_keys"`);
        await queryRunner.query(`DROP TABLE "processed_messages"`);
        await queryRunner.query(`DROP INDEX "IDX_outbox_unpublished"`);
        await queryRunner.query(`DROP TABLE "outbox"`);
    }
}
