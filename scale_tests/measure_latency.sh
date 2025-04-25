#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# CONFIG (adjust if your paths, ports or payload differ)
# ──────────────────────────────────────────────────────────────────────────────
IMPORT_PATH="proto"
PROTO_FILE="scheduler.proto"
METHOD="cam.Scheduler/Enqueue"
ADDRESS="localhost:50051"
PAYLOAD='{"job":{"id":"scale-test","priority":1}}'
CONCURRENCY=100
DURATION="10s"
OUTPUT_JSON="scale_tests/tmp-ghz.json"
# ──────────────────────────────────────────────────────────────────────────────

# 1) Run ghz, capture full JSON
echo "🚀 running ghz load test (–concurrency $CONCURRENCY, –duration $DURATION)…"
ghz \
  -i "$IMPORT_PATH" \
  --proto "$PROTO_FILE" \
  --call "$METHOD" \
  --insecure \
  --data "$PAYLOAD" \
  "$ADDRESS" \
  --concurrency "$CONCURRENCY" \
  --duration "$DURATION" \
  --format=json \
  --output "$OUTPUT_JSON"

echo "✅ ghz JSON written to $OUTPUT_JSON"
echo

# 2) Use jq to pick percentiles
echo "📊 Extracting RPS & latency percentiles …"
jq -r '
  . as $root
  # first, try histogram.latency.pxx
  | if $root.histogram and $root.histogram.latency then
      {
        rps: $root.rps,
        p50:  $root.histogram.latency.p50,
        p90:  $root.histogram.latency.p90,
        p95:  $root.histogram.latency.p95,
        p99:  $root.histogram.latency.p99
      }
    # else, try latencyDistribution array
    elif $root.latencyDistribution then
      reduce $root.latencyDistribution[] as $i ( { rps: $root.rps }; . + { ("p"+($i.quantile*100|tostring)): $i.value } )
    # fallback: build raw array from details → sort → pick indices
    else
      ( $root.details
        | map(select(.status=="OK")|.latency)
        | sort
      ) as $l
      | {
          rps: $root.rps,
          p50:  $l[(($l|length)*0.50|floor)],
          p90:  $l[(($l|length)*0.90|floor)],
          p95:  $l[(($l|length)*0.95|floor)],
          p99:  $l[(($l|length)*0.99|floor)]
        }
    end
' "$OUTPUT_JSON"

