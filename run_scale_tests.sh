#!/usr/bin/env bash
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)"          # repo root
source .venv/bin/activate
pip install --upgrade pip wheel >/dev/null
pip install -r requirements.txt >/dev/null
export PROM_METRICS_PORT=8000
nohup python -m src.server.app > server.log 2>&1 &
echo "✔️ Server PID $!  (logs → server.log)"
printf "⌛ waiting for gRPC… "
for i in {1..25}; do nc -z localhost 50051 && echo "✅ gRPC up" && break; sleep 0.2; done
cd scale_tests
chmod +x scale_test.sh
./scale_test.sh
echo; column -s, -t results.csv
echo "✅ Finished. See $PWD/scale_tests/results.csv"
echo
echo "agents  rps"
# read & print with 2‑decimals
tail -n +2 scale_tests/results.csv | \
  while IFS=, read -r agents rps; do
    printf "%6s  %7.2f\n" "$agents" "$rps"
  done
