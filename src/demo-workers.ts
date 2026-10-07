import { AppDataSource } from "./data-source";
import { Job } from "./entities/job.entity";

const JOBS = 20;
const WORKERS = 2;
const EMPTY_TRIES = 5;
const WORK_MS = 80;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimOne(workerId: string): Promise<boolean> {
    return AppDataSource.transaction(async (manager) => {
        const raw = (await manager.query(
            `SELECT id FROM jobs
             WHERE status = 'pending'
             ORDER BY id
             FOR UPDATE SKIP LOCKED
             LIMIT 1`,
        )) as Array<{ id: string }>;


        if (raw.length === 0) {
            return false;
        }

        await sleep(WORK_MS);

        await manager.query(
            `UPDATE jobs
             SET status = 'done',
                 processed = processed + 1,
                 worker_id = $1
             WHERE id = $2`,
            [workerId, raw[0].id],
        );

        return true;
    });
}

async function workerLoop(workerId: string): Promise<number> {
    let done = 0;
    let empty = 0;
    while (empty < EMPTY_TRIES) {
        const got = await claimOne(workerId);
        if (got) {
            done += 1;
            empty = 0;
        } else {
            empty += 1;
            await sleep(20);
        }
    }
    return done;
}

async function main(): Promise<void> {
    await AppDataSource.initialize();
    const jobs = AppDataSource.getRepository(Job);

    for (let i = 0; i < JOBS; i += 1) {
        await jobs.save(
            jobs.create({
                type: "send_booking_email",
                payload: { demo: i },
                status: "pending",
                processed: 0,
                workerId: null,
            }),
        );
    }

    const started = Date.now();
    const counts = await Promise.all(
        Array.from({ length: WORKERS }, (_, i) => workerLoop(`w${i + 1}`)),
    );
    const elapsedMs = Date.now() - started;

    const twice: { count: string }[] = await AppDataSource.query(
        `SELECT count(*)::text AS count FROM jobs WHERE processed > 1`,
    );
    const processedTwice = Number(twice[0].count);

    counts.forEach((n, i) => {
        console.log(`worker w${i + 1}: ${n}`);
    });
    console.log(`processed twice: ${processedTwice}`);
    console.log(`elapsed ms: ${elapsedMs}`);

    await AppDataSource.destroy();

    const total = counts.reduce((a, b) => a + b, 0);
    const sequentialGuess = JOBS * WORK_MS;
    const allWorkersBusy = counts.every((n) => n > 0);

    if (processedTwice !== 0 || total < JOBS || !allWorkersBusy || elapsedMs >= sequentialGuess) {
        console.error("workers invariant failed");
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});