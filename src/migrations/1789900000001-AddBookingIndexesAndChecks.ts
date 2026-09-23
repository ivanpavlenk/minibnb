import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingIndexesAndChecks1789900000001 implements MigrationInterface {
    name = "AddBookingIndexesAndChecks1789900000001";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "users" ADD CONSTRAINT "CHK_users_role" CHECK ("role" IN ('host', 'guest'))`,
        );
        await queryRunner.query(
            `ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_status" CHECK ("status" IN ('requested', 'confirmed', 'cancelled'))`,
        );
        await queryRunner.query(
            `CREATE INDEX "bookings_guest_created_idx" ON "bookings" ("guest_id", "created_at")`,
        );
        await queryRunner.query(
            `CREATE INDEX "bookings_cancelled_idx" ON "bookings" ("guest_id") WHERE status = 'cancelled'`,
        );
        await queryRunner.query(
            `CREATE INDEX "bookings_lower_status_idx" ON "bookings" ((lower(status)))`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "bookings_lower_status_idx"`);
        await queryRunner.query(`DROP INDEX "bookings_cancelled_idx"`);
        await queryRunner.query(`DROP INDEX "bookings_guest_created_idx"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_status"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "CHK_users_role"`);
    }
}
