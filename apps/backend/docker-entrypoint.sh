#!/bin/sh
set -eu

cd /app/apps/backend

# Migrations are intentionally excluded here. Production Compose runs the
# one-shot migrate service and refuses to start this container if it fails.
if [ -n "${LOAD_DEMO_DATA:-}" ]; then
  echo "Loading demo data (scale=${LOAD_DEMO_DATA_SCALE:-medium})..."
  bun prisma/demo-data/cli.ts load --scale="${LOAD_DEMO_DATA_SCALE:-medium}"
fi

exec bun dist/main.js
