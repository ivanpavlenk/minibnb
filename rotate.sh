#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SECRET_FILE="$ROOT/secrets/db_password"
NEW_PASSWORD="${1:-minibnb-rotated}"

echo "1. ALTER ROLE..."
docker compose exec -T postgres \
  psql -U minibnb -d minibnb -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE minibnb WITH PASSWORD '${NEW_PASSWORD}';"

echo "2. write secret file..."
printf '%s' "$NEW_PASSWORD" > "$SECRET_FILE"

echo "3. terminate old connections..."
docker compose exec -T postgres \
  psql -U minibnb -d minibnb -v ON_ERROR_STOP=1 \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'minibnb' AND pid <> pg_backend_pid();"

echo "done. new password is in secrets/db_password"