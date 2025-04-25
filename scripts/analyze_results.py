#!/usr/bin/env python3

import pandas as pd
from tabulate import tabulate
import sys
from pathlib import Path

BASE = Path(__file__).parent.parent
scale_csv = BASE / "scale_tests" / "results.csv"
soak_csv  = BASE / "scale_tests" / "soak_results.csv"

# ─── 1) Scale test ────────────────────────────────────────────────────────────
df_scale = pd.read_csv(scale_csv)
print("\n📈 Scale Test Throughput (agents → RPS):")
print(tabulate(df_scale, headers="keys", tablefmt="github", showindex=False))

# ─── 2) Soak summary ──────────────────────────────────────────────────────────
print("\n🛁 Soak Test Summary:")
try:
    df_soak = pd.read_csv(soak_csv)
except FileNotFoundError:
    print(f"⚠️  No soak CSV found at {soak_csv}")
    sys.exit(0)

total = len(df_soak)
status_counts = df_soak['status'].value_counts()
rows = [
    { "status": s, "count": c, "pct": f"{(c/total*100):.1f}%" }
    for s, c in status_counts.items()
]
print(tabulate(rows, headers="keys", tablefmt="github", showindex=False))

# ─── 3) Latency stats for successes ────────────────────────────────────────────
dur_col = next((c for c in df_soak.columns if "duration" in c.lower()), None)
if not dur_col:
    print("⚠️  No duration column found; skipping latency stats.")
    sys.exit(0)

lat_ok = df_soak[df_soak["status"] == "OK"][dur_col]
if lat_ok.empty:
    print("ℹ️  No successful calls to report latency stats on.")
    sys.exit(0)

print("\n⏱️  Soak Latency (ms) for successful calls:")
print(tabulate(
    {
        "p50": [lat_ok.quantile(0.50)],
        "p90": [lat_ok.quantile(0.90)],
        "p95": [lat_ok.quantile(0.95)],
        "max": [lat_ok.max()]
    },
    headers="keys",
    tablefmt="github",
    showindex=False
))
