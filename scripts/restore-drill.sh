#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL: unbound variable}"

export MSYS_NO_PATHCONV=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DRILL_NAME="${DRILL_NAME:-minibnb-restore-drill}"
DRILL_VOLUME="${DRILL_VOLUME:-minibnb_restore_drill}"
CHECK_SQL="SELECT count(*)::text || '|' || coalesce(sum(total_amount), 0)::text FROM bookings"

DUMP="$(ls -t "$ROOT"/backups/*.dump 2>/dev/null | head -n 1 || true)"
if [ -z "$DUMP" ]; then
  echo "no dump in $ROOT/backups — run backup.sh first" >&2
  exit 1
fi

host_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$1"
  else
    printf '%s\n' "$1"
  fi
}

live_checksum() {
  if command -v psql >/dev/null 2>&1; then
    psql --dbname="$DATABASE_URL" -Atc "$CHECK_SQL"
  else
    MSYS_NO_PATHCONV=1 docker compose exec -T -e PGPASSWORD=minibnb postgres \
      psql -h pgbouncer -p 6432 -U minibnb -d minibnb -Atc "$CHECK_SQL"
  fi
}

cleanup() {
  docker rm -f "$DRILL_NAME" >/dev/null 2>&1 || true
  docker volume rm "$DRILL_VOLUME" >/dev/null 2>&1 || true
}

trap cleanup EXIT

cleanup

BEFORE="$(live_checksum | tr -d '\r')"
echo "before: $BEFORE"

docker volume create "$DRILL_VOLUME" >/dev/null
docker run -d --name "$DRILL_NAME" \
  -e POSTGRES_USER=minibnb \
  -e POSTGRES_PASSWORD=minibnb \
  -e POSTGRES_DB=minibnb \
  -v "${DRILL_VOLUME}:/var/lib/postgresql/data" \
  postgres:16-alpine >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$DRILL_NAME" pg_isready -U minibnb -d minibnb >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

docker cp "$(host_path "$DUMP")" "$DRILL_NAME":/tmp/restore.dump
docker exec -e PGPASSWORD=minibnb "$DRILL_NAME" \
  pg_restore --no-owner --no-acl -U minibnb -d minibnb /tmp/restore.dump

AFTER="$(docker exec -e PGPASSWORD=minibnb "$DRILL_NAME" \
  psql -U minibnb -d minibnb -Atc "$CHECK_SQL" | tr -d '\r')"
echo "after:  $AFTER"
echo "dump:   $DUMP"

if [ "$BEFORE" != "$AFTER" ]; then
  echo "MISMATCH" >&2
  exit 1
fi

echo "MATCH"
