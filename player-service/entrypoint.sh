#!/bin/sh
set -e

echo "[player-service] Running Prisma migrations…"
for i in $(seq 1 10); do
  npx prisma db push --skip-generate && break
  echo "[player-service] DB not ready, retrying in 5s... ($i/10)"
  sleep 5
done

echo "[player-service] Starting server…"
exec node dist/index.js
