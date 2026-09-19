import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStockBalanceJobs1789812398176 implements MigrationInterface {
    name = 'AddStockBalanceJobs1789812398176'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "jobs" ("id" BIGSERIAL NOT NULL, "type" text NOT NULL, "payload" jsonb NOT NULL, "status" text NOT NULL, "processed" integer NOT NULL DEFAULT '0', "worker_id" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cf0a6c42b72fcc7f7c237def345" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "listings" ADD "stock" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "balance_cents" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "balance_cents"`);
        await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "stock"`);
        await queryRunner.query(`DROP TABLE "jobs"`);
    }

}
