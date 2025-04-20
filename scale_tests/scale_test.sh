#!/usr/bin/env bash
set -euo pipefail

# ── gRPC proto & endpoint ───────────────────────────────────────────────
IMPORT_PATH="../proto"               # where to find your .proto
PROTO_FILE="scheduler.proto"         # filename under $IMPORT_PATH
ADDRESS="localhost:50051"            # your gRPC server address
METHOD="cam.Scheduler/Enqueue"       # fully‑qualified RPC
PAYLOAD='{"job":{"id":"scale-test","priority":1}}'

# ── Output CSV ──────────────────────────────────────────────────────────
OUTPUT="results.csv"
echo "agents,rps" > "$OUTPUT"

for AGENTS in 1 10 50 100 500 1000; do
  echo "Running with $AGENTS agents…"

  # run ghz with correct flags
  ghz \
    --import-path "$IMPORT_PATH" \
    --proto "$PROTO_FILE" \
    --call "$METHOD" \
    --insecure \
    --data "$PAYLOAD" \
    "$ADDRESS" \
    --concurrency "$AGENTS" \
    --total 1000 \
    --output json \
    > "results-${AGENTS}.json"

  # extract requests/sec (fallback to old field if needed)
  TPS=$(jq -r '.summary.requests_per_second // .summary.rps // 0' "results-${AGENTS}.json")
  echo "$AGENTS,$TPS" >> "$OUTPUT"
done

echo "✅ Finished. See results.csv"
