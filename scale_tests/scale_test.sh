#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scale_tests/scale_test.sh — run ghz load tests at various concurrencies
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# 0) run from this script’s folder
cd "$(dirname "$0")"

# ── gRPC proto & endpoint ───────────────────────────────────────────────────
IMPORT_PATH="../proto"               # where to find your .proto files
PROTO_FILE="scheduler.proto"         # filename under $IMPORT_PATH
ADDRESS="localhost:50051"            # your gRPC server address
METHOD="cam.Scheduler/Enqueue"       # fully‑qualified RPC
PAYLOAD='{"job":{"id":"scale-test","priority":1}}'

# ── Output CSV ──────────────────────────────────────────────────────────────
OUTPUT="results.csv"
echo "agents,rps" > "$OUTPUT"

for AGENTS in 1 10 50 100 500 1000; do
  echo "→ Running with $AGENTS agents…"

  ghz \
    -i "$IMPORT_PATH" \
    --proto "$PROTO_FILE" \
    --call "$METHOD" \
    --insecure \
    --data "$PAYLOAD" \
    --concurrency "$AGENTS" \
    --total 1000 \
    --format=json \
    --output "results-${AGENTS}.json" \
    "$ADDRESS"

  # extract top‑level rps from the ghz JSON
  RPS=$(jq -r '.rps // 0' "results-${AGENTS}.json")
  echo "$AGENTS,$RPS" >> "$OUTPUT"
done

echo "✅ Finished. See $(realpath "$OUTPUT")"
