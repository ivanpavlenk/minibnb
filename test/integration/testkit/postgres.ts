import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { User } from '../../../src/entities/user.entity';
import { Listing } from '../../../src/entities/listing.entity';
import { Booking } from '../../../src/entities/booking.entity';
import { Review } from '../../../src/entities/review.entity';
import { Job } from '../../../src/entities/job.entity';
import { InitSchema1789302787829 } from '../../../src/migrations/1789302787829-InitSchema';
import { AddStockBalanceJobs1789812398176 } from '../../../src/migrations/1789812398176-AddStockBalanceJobs';

export type TestDb = {
    container: StartedPostgreSqlContainer;
    ds: DataSource;
};

export async function startTestDb(): Promise<TestDb> {
    const container = await new PostgreSqlContainer('postgres:16-alpine')
        .withDatabase('minibnb')
        .withUsername('minibnb')
        .withPassword('minibnb')
        .start();

    applyDbEnv(container);

    const ds = new DataSource({
        type: 'postgres',
        host: container.getHost(),
        port: container.getPort(),
        username: container.getUsername(),
        password: container.getPassword(),
        database: container.getDatabase(),
        synchronize: false,
        logging: false,
        entities: [User, Listing, Booking, Review, Job],
        migrations: [InitSchema1789302787829, AddStockBalanceJobs1789812398176],
    });
    await ds.initialize();
    await ds.runMigrations();
    await ensureHealthCheck(ds);
    return { container, ds };
}

export async function truncateAll(ds: DataSource): Promise<void> {
    await ds.query(
        `TRUNCATE TABLE reviews, bookings, listings, jobs, users RESTART IDENTITY CASCADE`,
    );
}

export async function stopTestDb(db?: TestDb): Promise<void> {
    if (!db) {
        return;
    }
    if (db.ds?.isInitialized) {
        await db.ds.destroy();
    }
    if (db.container) {
        await db.container.stop();
    }
}

function applyDbEnv(container: StartedPostgreSqlContainer): void {
    const passwordFile = join(tmpdir(), 'minibnb-test-db-password');
    writeFileSync(passwordFile, container.getPassword(), 'utf8');

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = container.getHost();
    process.env.DB_PORT = String(container.getPort());
    process.env.DB_USER = container.getUsername();
    process.env.DB_PASSWORD = container.getPassword();
    process.env.DB_NAME = container.getDatabase();
    process.env.DB_PASSWORD_FILE = passwordFile;
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.SKIP_VAULT = '1';
}

async function ensureHealthCheck(ds: DataSource): Promise<void> {
    await ds.query(`
        CREATE TABLE IF NOT EXISTS health_check (
            id INT PRIMARY KEY,
            note TEXT NOT NULL
        )
    `);
    await ds.query(`
        INSERT INTO health_check (id, note) VALUES (1, 'ok')
        ON CONFLICT (id) DO NOTHING
    `);
}
