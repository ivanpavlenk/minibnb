# MiniBnB — HW 1 (API contract)

**Variant B** — runtime validation at the boundary (`express-openapi-validator`).
Variant A (Pact) is not used.

The OpenAPI spec is the source of truth. A small Express server loads that spec, validates requests and responses against it, and maps validator errors to `application/problem+json`. Data lives in memory (arrays / `Map`). There is no database.

## Install and run

```bash
npm install
npm start
```

Server: http://localhost:3000

## Spec checks (acceptance criteria)

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

## Variant B checks (server must be running)

Domain is Airbnb-like, so the create endpoint is `POST /bookings` (not `/orders`).
Invalid body uses `guests: 0` (schema `minimum: 1`) — same role as empty `items` in the marketplace draft.

**No Idempotency-Key → 400 `application/problem+json`** (the spec requires the header, not an `if` in the handler):

```bash
curl -i -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -d '{"listing_id":1,"check_in":"2026-09-01","check_out":"2026-09-05","guests":2}'
```

Expected `detail`: `request/headers must have required property 'idempotency-key'`.

**Invalid body → 400** from the validator:

```bash
curl -i -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: k1" \
  -d '{"listing_id":1,"check_in":"2026-09-01","check_out":"2026-09-05","guests":0}'
```

Expected `detail` about `guests` / minimum.

**Valid request → 201**:

```bash
curl -i -X POST http://localhost:3000/bookings \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: k1" \
  -d '{"listing_id":1,"check_in":"2026-09-01","check_out":"2026-09-05","guests":2}'
```

Same key + same body again → 201 and `Idempotency-Replay: true`.
Same key + different body → 422 `application/problem+json`.

Cursor pagination:

```bash
curl -i "http://localhost:3000/listings?limit=2"
```

Response has `items` and `next_cursor` (`null` means no further pages). Pass `next_cursor` as-is into `cursor` for the next page.

## Layout

| Path | Role |
|---|---|
| `openapi/openapi.yaml` | Contract: 2 resources, 5 operations, cursor pagination, Idempotency-Key, problem+json |
| `src/app.js` | Express app, OpenAPI validator, in-memory data |
| `src/server.js` | `npm start` entrypoint |
