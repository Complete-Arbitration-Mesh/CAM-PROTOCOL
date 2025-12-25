# Benchmark Methodology

This document describes how CAM Protocol benchmarks are conducted and how to interpret the results.

## Overview

CAM Protocol benchmarks measure:
- **Cost optimization** - Savings from intelligent provider routing
- **Multi-agent collaboration** - Performance of task decomposition and coordination
- **Reliability** - Failover timing and recovery metrics

## Environment Assumptions

### Default Test Environment
- **Node.js**: v18.x or v20.x
- **Memory**: 4GB+ available RAM
- **Disk**: 1GB+ available for logs and outputs
- **Network**: Stable internet (for real provider tests)

### Mock Provider Environment
By default, benchmarks run against **mock providers** to ensure reproducibility without incurring API costs.

Mock providers simulate:
- Variable latency (10-500ms based on provider tier)
- Token counting (based on input/output length)
- Cost calculation (using published pricing models)

### Real Provider Environment
For production-accurate results, configure real API keys:

```bash
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-..."
export GOOGLE_API_KEY="..."
```

## Benchmark Scripts

### Cost Optimization Benchmark

**Location:** `tests/benchmarks/cost-optimization-benchmark.ts`

**What it measures:**
- Cost per request across providers
- Cost savings from intelligent routing
- Response latency by provider

**How to run:**
```bash
npm run benchmark:cost
```

**Output:** `costs.json` in project root with:
```json
{
  "totalRequests": 100,
  "directCosts": { "openai": 1.50, "anthropic": 1.20 },
  "camCosts": 0.95,
  "savingsPercent": 29.3,
  "averageLatencyMs": 145
}
```

**Methodology:**
1. Runs N requests (default: 100) across M prompts
2. For each prompt, measures:
   - Direct cost (if sent to most expensive provider)
   - CAM cost (with intelligent routing)
3. Calculates savings as: `(directCost - camCost) / directCost * 100`

### Multi-Agent Collaboration Benchmark

**Location:** `tests/benchmarks/multi-agent-collaboration-benchmark.ts`

**What it measures:**
- Task decomposition accuracy
- Agent coordination overhead
- End-to-end task completion time
- Quality of composed results

**How to run:**
```bash
npm run benchmark:collaboration
```

**Output:** `collaboration-results.json`

### Value Demonstration

**Location:** `examples/demonstration/value-demonstration.ts`

**What it measures:**
- Failover timing (how fast CAM switches providers on failure)
- Recovery metrics (successful recovery rate)
- Overall availability improvement

**How to run:**
```bash
npm run demo:value
```

## How Metrics Are Computed

### Cost Metrics

| Metric | Formula |
|--------|---------|
| Cost per request | `(input_tokens * input_price + output_tokens * output_price) / 1000` |
| Total cost | Sum of all request costs |
| Cost savings | `(direct_cost - cam_cost) / direct_cost * 100%` |

**Provider pricing used (per 1K tokens):**

| Provider | Input | Output |
|----------|-------|--------|
| OpenAI GPT-4 | $0.01 | $0.03 |
| Anthropic Claude | $0.008 | $0.024 |
| Cohere | $0.005 | $0.015 |

*Note: Prices are approximations. Actual pricing varies by model and tier.*

### Latency Metrics

| Metric | Formula |
|--------|---------|
| Request latency | `end_time - start_time` (ms) |
| P50 latency | 50th percentile of all request latencies |
| P95 latency | 95th percentile of all request latencies |
| P99 latency | 99th percentile of all request latencies |

### Reliability Metrics

| Metric | Formula |
|--------|---------|
| Failover time | Time from error detection to successful alternate request |
| Recovery rate | `successful_recoveries / total_failures * 100%` |
| Availability | `successful_requests / total_requests * 100%` |

## Configuration Knobs

Modify benchmark behavior via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `BENCHMARK_REQUESTS` | 100 | Number of requests per benchmark |
| `BENCHMARK_TIMEOUT` | 30000 | Request timeout in ms |
| `BENCHMARK_MOCK_LATENCY` | 100 | Base mock provider latency in ms |
| `BENCHMARK_OUTPUT_DIR` | `.` | Directory for output files |

Example:
```bash
BENCHMARK_REQUESTS=500 npm run benchmark:cost
```

## Output Locations

| Benchmark | Output File |
|-----------|-------------|
| Cost optimization | `./costs.json` |
| Collaboration | `./collaboration-results.json` |
| Value demo | stdout + metrics printed |

## Interpreting Results

### Expected Ranges (Mock Providers)

| Metric | Expected Range | Notes |
|--------|----------------|-------|
| Cost savings | 20-40% | Depends on prompt mix |
| Latency overhead | 5-15ms | CAM routing overhead |
| Failover time | 100-500ms | Time to detect + retry |

### Factors That Affect Real Results

1. **Provider latency** - Geographic distance, load, model size
2. **Request complexity** - Token count, reasoning depth
3. **Concurrency** - Rate limits, throttling
4. **Network conditions** - Packet loss, jitter

### Disclaimers

- Mock benchmarks provide **relative comparisons**, not absolute production metrics
- Real-world savings depend on your specific workload patterns
- Provider pricing changes frequently; verify current rates
- Enterprise tiers may have different cost structures

## Running Your Own Benchmarks

For production-accurate benchmarks:

1. **Configure real providers:**
   ```bash
   export OPENAI_API_KEY="..."
   export ANTHROPIC_API_KEY="..."
   ```

2. **Use production-like prompts:**
   Edit `TEST_PROMPTS` in the benchmark files to match your workload.

3. **Run with sufficient samples:**
   ```bash
   BENCHMARK_REQUESTS=1000 npm run benchmark:cost
   ```

4. **Review output files:**
   Check `costs.json` and `collaboration-results.json` for detailed breakdowns.

## Related Documentation

- [Proof of Value](../PROOF_OF_VALUE.md) - Business value analysis
- [Deployment Readiness](../DEPLOYMENT_READINESS.md) - Production checklist
- [Performance Tuning](../guides/performance-tuning.md) - Optimization tips
