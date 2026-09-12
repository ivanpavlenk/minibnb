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
| `docker-compose.yml` | Local Postgres |
| `Dockerfile` / `.dockerignore` | Image without `.env` or `secrets/` |
