#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL: unbound variable}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STAMP="$(date +%Y-%m-%d)"
OUT_DIR="$ROOT/backups"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/minibnb-${STAMP}.dump"

if command -v pg_dump >/dev/null 2>&1; then
  pg_dump -Fc --dbname="$DATABASE_URL" -f "$FILE"
else
  MSYS_NO_PATHCONV=1 docker compose exec -T -e PGPASSWORD=minibnb postgres \
    pg_dump -h pgbouncer -p 6432 -U minibnb -d minibnb -Fc -f /tmp/minibnb.dump
  DEST="$FILE"
  if command -v cygpath >/dev/null 2>&1; then
    DEST="$(cygpath -w "$FILE")"
  fi
  MSYS_NO_PATHCONV=1 docker compose cp postgres:/tmp/minibnb.dump "$DEST"
fi

echo "$FILE"