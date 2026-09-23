# MiniBnB

Listings/bookings HTTP handlers still use in-memory data for HW1. HW3 puts MiniBnB tables in Postgres (`db/`). **Main table: `bookings`.**

## Raise Postgres / connect (fresh clone)

```bash
docker compose up -d --wait
```

```bash
docker compose exec -T postgres psql -U minibnb -d minibnb -Atc "SELECT 1"
```

Dev credentials are in `docker-compose.yml` (user/password/db `minibnb`). For the Nest app copy `secrets/db_password.example` → `secrets/db_password`.

## Schema, seed, EXPLAIN

```bash
docker compose down -v && docker compose up -d --wait
docker compose exec -T postgres psql -U minibnb -d minibnb -f - < db/schema.sql
docker compose exec -T postgres psql -U minibnb -d minibnb -f - < db/seed.sql
docker compose exec -T postgres psql -U minibnb -d minibnb -Atc "SELECT count(*) FROM bookings;"
docker compose exec -T postgres psql -U minibnb -d minibnb -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q1.sql)"
docker compose exec -T postgres psql -U minibnb -d minibnb -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q2.sql)"
docker compose exec -T postgres psql -U minibnb -d minibnb -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q3.sql)"
docker compose exec -T postgres psql -U minibnb -d minibnb -f - < db/indexes.sql
docker compose exec -T postgres psql -U minibnb -d minibnb -c "ANALYZE;"
docker compose exec -T postgres psql -U minibnb -d minibnb -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q1.sql)"
docker compose exec -T postgres psql -U minibnb -d minibnb -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q2.sql)"
docker compose exec -T postgres psql -U minibnb -d minibnb -c "EXPLAIN (ANALYZE, BUFFERS) $(cat db/queries/q3.sql)"
```

On Git Bash, prefix `docker compose exec` with `MSYS_NO_PATHCONV=1` if paths get rewritten.

## Install and run the API

```bash
npm install
cp .env.example .env          # Unix
# Windows: copy .env.example .env
docker compose up -d --wait
npm start
```

If port 5432 is already taken on the host, keep compose mapping `5433:5432` and set `DB_PORT=5433` in `.env`.

Server: http://localhost:3000

`start` is a one-shot process (`tsc && node`), not watch. Use `npm run start:dev` only for local reload.

## Configuration

Env is validated on boot by `src/config/env.schema.ts` via `ConfigModule.forRoot({ validate })`. A broken variable kills the process (exit ≠ 0) with the variable name in the error. Application code reads `ConfigService<Env, true>` only — no `process.env`.

The database password is **not** an env var. It is read from the file in `DB_PASSWORD_FILE` on every new `pg.Pool` connection.

| Variable | Required | Meaning |
|---|---|---|
| `NODE_ENV` | no (default `development`) | `development` \| `test` \| `production` |
| `PORT` | no (default `3000`) | HTTP port |
| `DB_HOST` | yes | Postgres host |
| `DB_PORT` | no (default `5432`) | Postgres port |
| `DB_NAME` | yes | Database name |
| `DB_USER` | yes | Database user |
| `DB_PASSWORD_FILE` | yes | Path to the password file (not the password) |
| `DATABASE_URL` | no | App connection URI. **Source: Infisical** (dev/prod). Fake password in `.env.example` only |

`.env.example` is the contract in git (fake values + comments). Real `.env` is gitignored. Sync check:

```bash
npm run check:env
```

Create the password file (must match `POSTGRES_PASSWORD` / `init.sql` on first boot):

```bash
mkdir -p secrets
echo -n minibnb > secrets/db_password
```

### Fail-fast

Temporarily hide `.env` so dotenv cannot fill gaps, then start without a required variable:

```bash
mv .env /tmp
env -u DB_HOST npm run start
echo $?
mv /tmp/.env .
```

Expect exit ≠ 0 and `DB_HOST` in the output.

### Password rotation (no process restart)

Keep `npm start` running.

```bash
curl -s http://localhost:3000/health   # remember uptime
bash rotate.sh                         # default new password: minibnb-rotated
curl -s http://localhost:3000/health   # 200, db=ok, uptime larger than before
```

`rotate.sh` order: `ALTER ROLE` → rewrite `secrets/db_password` → `pg_terminate_backend`. Restore the starter password with `bash rotate.sh minibnb`.

After `docker compose down -v`, Postgres is back to password `minibnb`. Put `minibnb` in `secrets/db_password` again or auth fails.

### Docker image (no secrets in layers)

```bash
docker build -t myapp .
docker run --rm myapp ls -a /app
docker run --rm myapp sh -c 'cat /app/.env' 2>&1
docker inspect --format '{{.Config.Env}}' myapp
docker history --no-trunc myapp | grep -i password
```

Expect `.env.example` present, no `.env`, no `secrets/`, `cat .env` → No such file, inspect/history without passwords.

### Infisical (optional, no extra points)

Secrets for env vars can live in Infisical. The DB password file stays on disk so rotation still works.

```bash
infisical.cmd run --env=dev -- npm run start   # Windows PowerShell
```

## HW 1 spec checks

Run from the repo root after `npm install`. On Windows use **Git Bash** for `grep` and the `node -e` one-liner.

```bash
npx @redocly/cli@2.46.0 lint openapi/openapi.yaml
```

Exit code 0 is required (warnings are allowed, errors are not).

```bash
npx @redocly/cli@2.46.0 bundle openapi/openapi.yaml -o spec.json

node -e "const s=require('./spec.json'),M=['get','post','put','patch','delete']; const ops=Object.entries(s.paths).flatMap(([p,v])=>Object.keys(v).filter(m=>M.includes(m)).map(m=>[p,m])); const idem=ops.flatMap(([p,m])=>s.paths[p][m].parameters??[]).find(x=>x.in==='header'&&/idempotency-key/i.test(x.name)); console.log('операцій:',ops.length,'· ресурсів:',new Set(Object.keys(s.paths).map(p=>p.split('/')[1])).size); console.log('Idempotency-Key: required =',idem?.required,'· опис, символів =',(idem?.description??'').trim().length)"
```

Expected: operations ≥ 5 · resources ≥ 2 · `required = true` · description length ≥ 40.

```bash
grep -c 'Idempotency-Key' openapi/openapi.yaml
grep -c 'next_cursor' openapi/openapi.yaml
grep -c 'application/problem+json' openapi/openapi.yaml
```

Expected: ≥ 1, ≥ 1, ≥ 2.

## HW 1 API checks (server must be running)

Domain is Airbnb-like, so the create endpoint is `POST /bookings` (not `/orders`).
Invalid body uses `guests: 0` (schema `minimum: 1`).

**No Idempotency-Key → 400 `application/problem+json`:**

```bash
curl -i -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -d '{"listing_id":1,"check_in":"2026-09-01","check_out":"2026-09-05","guests":2}'
```

**Invalid body → 400:**

```bash
curl -i -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: k1" \
  -d '{"listing_id":1,"check_in":"2026-09-01","check_out":"2026-09-05","guests":0}'
```

**Valid request → 201:**

```bash
curl -i -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: k1" \
  -d '{"listing_id":1,"check_in":"2026-09-01","check_out":"2026-09-05","guests":2}'
```

Same key + same body again → 201 and `Idempotency-Replay: true`.
Same key + different body → 422 `application/problem+json`.

```bash
curl -i "http://localhost:3000/listings?limit=2"
```

## Layout

| Path | Role |
|---|---|
| `db/schema.sql` | MiniBnB tables + foreign keys |
| `db/seed.sql` | ≥ 100000 rows in `bookings` + `VACUUM (ANALYZE)` |
| `db/queries/` | q1–q3 (Seq Scan before indexes) |
| `db/indexes.sql` | btree + partial + `lower(status)` |
| `db/OPTIMIZATIONS.md` | EXPLAIN before/after |
| `secrets/db_password.example` | Dev password for a fresh clone |
| `openapi/openapi.yaml` | Contract: listings, bookings, health, cursor, Idempotency-Key, problem+json |
| `src/config/env.schema.ts` | Zod env schema + fail-fast `validate` |
| `scripts/check-env-example.mjs` | `.env.example` vs schema (`npm run check:env`) |
| `src/db/` | `pg.Pool`, password from file |
| `src/health/` | `GET /health` (uptime + DB ping) |
| `secrets/db_password` | DB password file (gitignored) |
| `rotate.sh` | Password rotation without process restart |
| `docker-compose.yml` | Local Postgres + PgBouncer |
| `pgbouncer/` | `pool_mode = transaction` config + userlist |
| `scripts/backup.sh` | Dated `pg_dump -Fc` into `backups/` |
| `scripts/restore-drill.sh` | Restore into a fresh volume and print MATCH |
| `backup.cron` | Nightly backup schedule |
| `RESTORE-DRILL.md` | Drill protocol: dump size, RTO, RPO |
| `Dockerfile` / `.dockerignore` | Image without `.env` or `secrets/` |
| `src/entities/` | TypeORM entities (users, listings, bookings, reviews) |
| `src/migrations/` | Generated schema migrations (`synchronize: false`) |
| `src/data-source.ts` | TypeORM DataSource; credentials from `process.env` |
| `src/seed.ts` | Idempotent demo rows |
| `src/demo-nplus1.ts` | N+1 naive vs JOIN, query counter |
| `src/report.ts` | Revenue by city via QueryBuilder |
| `src/checkout.ts` | Transactional hostel-bed booking + job enqueue |
| `src/demo-race.ts` | 50 parallel checkouts vs stock = 10 |
| `src/demo-workers.ts` | Two workers, `FOR UPDATE SKIP LOCKED` |
| `src/demo-retry.ts` | Retry wrapper for `40001` / `40P01` |
| `scripts/with-secrets.sh` | Infisical wrapper; `SKIP_VAULT=1` for CI/grader |

## TypeORM (HW 13)

Schema lives in entities plus a generated migration. `src/data-source.ts` sets `synchronize: false`. Commands that talk to Postgres are wrapped with `bash scripts/with-secrets.sh dev …`. TypeORM reads `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` from `process.env` (Infisical, or the grader via `SKIP_VAULT=1`). Nest HTTP still uses `DB_PASSWORD_FILE`; that path is separate.

```bash
npm ci
npx tsc --noEmit
docker compose up -d --wait
npm run build
npm run migrate
npm run migrate:show
npm run seed
npm run demo:nplus1
npm run report
```

### N+1 (booking → listing → owner)

Measured on 8 seeded bookings.

| Strategy | SQL queries |
|---|---|
| naive (query per booking in a loop) | 17 |
| `relations` / JOIN | 1 |

Naive is `1 + 8 + 8`: one `SELECT` for bookings, then listing and owner per row. After the JOIN the count is 1 and does not grow with N.

### Seed counts (idempotent)

```bash
npm run seed && npm run seed
docker compose exec -T postgres psql -U minibnb -d minibnb -c "SELECT (SELECT count(*) FROM users) AS users, (SELECT count(*) FROM listings) AS listings, (SELECT count(*) FROM bookings) AS bookings, (SELECT count(*) FROM reviews) AS reviews;"
```

Expected after one or two seeds: users 10, listings 8, bookings 8, reviews 5.

### Repository vs QueryBuilder

`Repository.find()` is for loading entities by id/where/relations (CRUD, and the N+1 fix with `relations`). `createQueryBuilder()` is for SQL the repository cannot express: aggregates, `GROUP BY`, reports. `src/report.ts` sums confirmed booking revenue per city — that is a QueryBuilder job, not `find()`.

### onDelete

- `listings.owner_id`, `bookings.listing_id`, `bookings.guest_id` → `RESTRICT`: a host, listing, or guest with history must not disappear and leave orphan rows.
- `reviews.booking_id` → `CASCADE`: a review has no meaning without its booking.

### synchronize

`src/data-source.ts` sets `synchronize: false`. Schema changes go through migrations only.

## Конкурентність (HW 14)

Checkout runs in one transaction: atomic `UPDATE listings SET stock = stock - $n WHERE stock >= $n RETURNING`, then the same for `users.balance_cents`, then `INSERT` booking and job. If beds or money are missing, the whole transaction rolls back — no orphan bookings.

`stock` is free hostel beds, not copies of an apartment. The race listing is a 10-bed hostel.

**Pessimistic `SELECT FOR UPDATE` vs atomic `UPDATE … RETURNING`.** Checkout uses the atomic `UPDATE`. One statement both checks and decrements; 0 rows means no beds. There is no JavaScript read-modify-write window. `FOR UPDATE` would also be valid (lock the row, then update); we skip the extra round-trip.

Retry catches **only** Postgres `40001` (serialization failure) and `40P01` (deadlock). Those mean “start the transaction over”. “No beds” / “no money” are business refusals and must not be retried. A retry reruns the **whole** transaction, including reads.

### Race (`npm run demo:race`)

50 parallel checkouts, qty = 1, initial stock = 10. Guest balances are huge so only stock limits success.

| | |
|---|---|
| attempts | 50 |
| successful | 10 |
| final stock | 0 |
| negative stock rows | 0 |

### Workers (`npm run demo:workers`)

Two in-process workers claim `jobs` with `SELECT … FOR UPDATE SKIP LOCKED`. Processing stays in the same transaction as the lock.

| | |
|---|---|
| worker w1 | 15 |
| worker w2 | 15 |
| processed twice | 0 |
| elapsed ms | 1554 |

15+15 includes leftover email jobs from the race plus 20 demo jobs.

### Retry (`npm run demo:retry`)

Two concurrent read-modify-write bumps under `REPEATABLE READ`, wrapped with backoff on `40001` / `40P01` only.

Logged several `caught 40001` retries. Start `1000000`, 20 bumps, final `1000020` (= expected).

## Data layer ops (HW 15)

The app reaches Postgres through **PgBouncer** (host port **6432**), not through the published Postgres port 5433. Compose still maps Postgres at 5433 for emergencies; TypeORM / `DATABASE_URL` use 6432.

**Why `pool_mode = transaction`:** many API processes can share a small set of real Postgres connections. PgBouncer assigns a server connection for one transaction, then gives it to another client. That is enough for checkout (`BEGIN` … `COMMIT`) and cheaper than session pooling.

Transaction mode **breaks session-scoped features**, at least:

1. **Named prepared statements** — they live on a server session; after COMMIT that session may serve someone else.
2. **Temporary tables** (`CREATE TEMP TABLE`) — they disappear when the session is returned to the pool.
3. **LISTEN/NOTIFY** (and `WITH HOLD` cursors / leftover session `SET`) — notifications and session state do not follow the client to the next checkout.

Mitigation in this repo: `max_prepared_statements = 200` in `pgbouncer/pgbouncer.ini`.

### Backup

```bash
export DATABASE_URL=postgres://minibnb:minibnb@127.0.0.1:6432/minibnb
export SKIP_VAULT=1
bash scripts/with-secrets.sh dev bash scripts/backup.sh
```

Prints the dump path (`backups/minibnb-YYYY-MM-DD.dump`). Schedule: `backup.cron` (03:00 every night).

### Restore

```bash
bash scripts/with-secrets.sh dev bash scripts/restore-drill.sh
```

Restores the newest dump into a **new empty** Postgres volume, compares `count(*)|sum(total_amount)` on `bookings`, prints `MATCH`, then deletes the drill container and volume. Protocol: `RESTORE-DRILL.md`.

## Grading

```bash
docker compose up -d --wait
export DB_HOST=127.0.0.1 DB_PORT=6432 DB_USER=minibnb DB_PASSWORD=minibnb DB_NAME=minibnb
export DATABASE_URL=postgres://minibnb:minibnb@127.0.0.1:6432/minibnb
export SKIP_VAULT=1    # у грейдера немає доступу до сховища
bash scripts/with-secrets.sh dev bash scripts/backup.sh
bash scripts/with-secrets.sh dev bash scripts/restore-drill.sh
```

Host **6432** is PgBouncer (`6432:6432`). User/password/database are `minibnb`. Direct Postgres remains `5433` and is not the app connection string.

`backup.sh` / `restore-drill.sh` read `DATABASE_URL` from the environment (the wrapper does not invent a new env file). With `SKIP_VAULT=1` the wrapper just runs the command.
