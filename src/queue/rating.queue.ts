import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue, Worker } from 'bullmq';
import { Env } from '../config/env.schema';

const QUEUE_NAME = 'listing-rating';

@Injectable()
export class RatingQueue implements OnModuleInit, OnModuleDestroy {
    private readonly log = new Logger(RatingQueue.name);
    private queue: Queue | null = null;
    private worker: Worker | null = null;

    constructor(private readonly config: ConfigService<Env, true>) {}

    async onModuleInit(): Promise<void> {
        const url = this.config.get('REDIS_QUEUE_URL', { infer: true });
        if (!url) {
            return;
        }
        const connection = { url, maxRetriesPerRequest: null as null };
        this.queue = new Queue(QUEUE_NAME, { connection });
        this.worker = new Worker(
            QUEUE_NAME,
            async (job: Job) => {
                this.log.debug(`rating job ${job.id} attempt ${job.attemptsMade + 1}`);
            },
            { connection },
        );
        await this.queue.upsertJobScheduler(
            'listing-rating-tick',
            { every: 60_000 },
            { name: 'tick', data: { kind: 'sched' } },
        );
    }

    async enqueueRecalc(listingId: string): Promise<void> {
        if (!this.queue) {
            return;
        }
        await this.queue.add(
            'recalc',
            { listingId },
            {
                jobId: `recalc-${listingId}`,
                attempts: 3,
                backoff: { type: 'exponential', delay: 200, jitter: 0.5 },
                removeOnComplete: { age: 3600 },
            },
        );
    }

    async onModuleDestroy(): Promise<void> {
        await this.worker?.close().catch(() => undefined);
        await this.queue?.close().catch(() => undefined);
    }
}
