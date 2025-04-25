#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────────────────────────────────────────────────────────
# 1) Start soak test in background and begin tailing its CSV
# ────────────────────────────────────────────────────────────────────────────────
echo
echo "🚀   Starting soak test (30 m @ 500c / 200 rps)…"
./scale_tests/soak_test.sh &
SOAK_PID=$!

echo "✅   Soak PID: $SOAK_PID"
echo

# Wait a moment for header, then show & follow
sleep 1
echo "📊   Live soak output:"
head -n5 scale_tests/soak_results.csv
echo "      (streaming new rows below)"
tail -n0 -F scale_tests/soak_results.csv &
TAIL_PID=$!

# ────────────────────────────────────────────────────────────────────────────────
# 2) Run the scale test immediately
# ────────────────────────────────────────────────────────────────────────────────
echo
echo "🚀   Running scale test now…"
./scale_tests/scale_test.sh

echo
echo "✅   Scale test complete → scale_tests/results.csv"
echo

# ────────────────────────────────────────────────────────────────────────────────
# 3) Clean up the live tail (so your prompt returns)
# ────────────────────────────────────────────────────────────────────────────────
echo "🛑   Stopping live soak tail..."
kill $TAIL_PID 2>/dev/null || true

# Leave the soak running (or kill it yourself)
echo
echo "📝   Soak is still running (PID $SOAK_PID)."
echo "      • To stop it now:  kill $SOAK_PID"
echo "      • Or let it run its full 30 m."
echo
