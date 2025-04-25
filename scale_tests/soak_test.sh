#!/usr/bin/env bash
set -euo pipefail

# ── 1) go to repo root ───────────────────────────────────────────────────
cd "$(dirname "$0")"/..

# ── 2) start the CAM server ─────────────────────────────────────────────
export PROM_METRICS_PORT=8000
echo "🚀 Starting CAM server (metrics→8000, gRPC→50051)…"
nohup python -m src.server.app > scale_tests/soak_server.log 2>&1 &
SERVER_PID=$!
# give it a moment
sleep 1

# wait up to 10s for gRPC port
echo -n "⌛ Waiting for gRPC on 50051 "
for i in {1..25}; do
  nc -z localhost 50051 && { echo "✅"; break; }
  sleep 0.2; echo -n "."
done

# ── 3) run the soak test ────────────────────────────────────────────────
echo "→ Running soak: 500 concurrency @ 200 RPS for 30 m…"
ghz \
  -i proto \
  --proto scheduler.proto \
  --call cam.Scheduler/Enqueue \
  --insecure \
  --data '{"job":{"id":"soak-test","priority":0}}' \
  localhost:50051 \
  --concurrency 500 \
  --rps 200 \
  --duration 30m \
  --format=csv \
  > scale_tests/soak_results.csv

echo "✅ Soak complete → scale_tests/soak_results.csv"

# ── 4) shut down the server ─────────────────────────────────────────────
echo "🛑 Stopping server (PID $SERVER_PID)…"
kill $SERVER_PID
