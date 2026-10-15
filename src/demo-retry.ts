import { AppDataSource } from "./data-source";
import { User } from "./entities/user.entity";

const PARALLEL = 2;
const BUMPS_EACH = 10;
const START_BALANCE = 1_000_000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function pgCode(err: unknown): string | undefined {
    if (typeof err !== "object" || err === null) {
        return undefined;
    }
    const anyErr = err as { code?: string; driverError?: { code?: string } };
    return anyErr.driverError?.code ?? anyErr.code;
}

function isRetryable(err: unknown): boolean {
    const code = pgCode(err);
    return code === "40001" || code === "40P01";
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
    let attempt = 1;
    for (;;) {
        try {
            return await fn();
        } catch (err) {
            if (!isRetryable(err)) {
                throw err;
            }
            const code = pgCode(err);
            console.log(`${label}: caught ${code}, retry #${attempt}`);
            await sleep(10 * attempt);
            attempt += 1;
        }
    }
}

async function bumpOnce(userId: string): Promise<void> {
    await AppDataSource.transaction("REPEATABLE READ", async (manager) => {
        const rows = (await manager.query(
            `SELECT balance_cents FROM users WHERE id = $1`,
            [userId],
        )) as Array<{ balance_cents: number }>;
        const current = Number(rows[0].balance_cents);
        const next = current + 1;
        await manager.query(
            `UPDATE users SET balance_cents = $1 WHERE id = $2`,
            [next, userId],
        );
    });
}

async function main(): Promise<void> {
    await AppDataSource.initialize();
    const users = AppDataSource.getRepository(User);

    const guest =
        (await users.findOne({ where: { email: "retry.guest@minibnb.test" } })) ??
        (await users.save(
            users.create({
                email: "retry.guest@minibnb.test",
                role: "guest",
                balanceCents: START_BALANCE,
            }),
        ));

    await users.update({ id: guest.id }, { balanceCents: START_BALANCE });

    const tasks: Promise<void>[] = [];
    for (let w = 0; w < PARALLEL; w += 1) {
        tasks.push(
            (async () => {
                for (let i = 0; i < BUMPS_EACH; i += 1) {
                    await withRetry(`w${w + 1}`, () => bumpOnce(guest.id));
                }
            })(),
        );
    }

    await Promise.all(tasks);

    const row: { balance_cents: number }[] = await AppDataSource.query(
        `SELECT balance_cents FROM users WHERE id = $1`,
        [guest.id],
    );
    const finalBalance = Number(row[0].balance_cents);
    const expected = START_BALANCE + PARALLEL * BUMPS_EACH;

    console.log(`start: ${START_BALANCE}`);
    console.log(`bumps: ${PARALLEL * BUMPS_EACH}`);
    console.log(`final: ${finalBalance}`);
    console.log(`expected: ${expected}`);

    await AppDataSource.destroy();

    if (finalBalance !== expected) {
        console.error("retry arithmetic failed");
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});