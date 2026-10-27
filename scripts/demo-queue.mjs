import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { fail, printKv, queueUrl } from './redis-hw23.mjs';

const QUEUE = 'hw23-rating';

async function main() {
    const url = queueUrl();
    const inspect = new Redis(url);
    const policy = await inspect.config('GET', 'maxmemory-policy');
    const policyName = Array.isArray(policy) ? policy[1] : '';
    const queueNoeviction = policyName === 'noeviction' ? 1 : 0;

    const connection = { url, maxRetriesPerRequest: null };
    const queue = new Queue(QUEUE, { connection: { url } });
    await queue.obliterate({ force: true }).catch(() => undefined);

    let attempts = 0;
    let completed = 0;
    let scheduledRuns = 0;

    const worker = new Worker(
        QUEUE,
        async (job) => {
            if (job.name === 'tick') {
                scheduledRuns += 1;
                return;
            }
            attempts += 1;
            if (attempts < 3) {
                throw new Error('transient');
            }
            completed += 1;
        },
        { connection, concurrency: 1 },
    );

    const jobOpts = {
        jobId: 'recalc-listing-1',
        attempts: 5,
        backoff: { type: 'exponential', delay: 80, jitter: 0.5 },
        removeOnComplete: { age: 3600 },
    };
    await queue.add('recalc', { listingId: '1' }, jobOpts);
    await queue.add('recalc', { listingId: '1' }, jobOpts);
    const added = 2;
    const waiting = await queue.getJobCounts();
    const queued = (waiting.waiting ?? 0) + (waiting.active ?? 0) + (waiting.delayed ?? 0);

    await queue.upsertJobScheduler(
        'hw23-tick',
        { every: 400 },
        { name: 'tick', data: { kind: 'sched' } },
    );
    const schedulers = (await queue.getJobSchedulers()).length;

    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline && (completed < 1 || scheduledRuns < 2 || attempts < 3)) {
        await new Promise((r) => setTimeout(r, 50));
    }

    printKv({
        'queue-noeviction': queueNoeviction,
        attempts,
        completed,
        added,
        queued,
        schedulers,
        'scheduled-runs': scheduledRuns,
    });

    await worker.close();
    await queue.close();
    await inspect.quit();

    if (
        completed !== 1 ||
        added !== 2 ||
        queued !== 1 ||
        queueNoeviction !== 1 ||
        attempts < 3 ||
        schedulers < 1 ||
        scheduledRuns < 2
    ) {
        fail('demo:queue invariant failed');
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
