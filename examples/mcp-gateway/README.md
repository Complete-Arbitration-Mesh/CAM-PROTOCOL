# MCP Gateway Demo

Demonstrates CAM as a governance layer above MCP servers.

## What This Demo Shows

1. **Two MCP servers** with overlapping tools ("search")
2. **CAM Gateway** selects server based on:
   - Trust tier (trusted > standard > untrusted)
   - Cost estimate (lower is better)
   - Latency metrics (faster is better)
   - Policy rules (can deny based on data classification)
3. **Audit record** produced for every decision

## Run the Demo

```bash
# From repo root
npm run build
npx ts-node examples/mcp-gateway/demo.ts

# Or with Node directly
node --loader ts-node/esm examples/mcp-gateway/demo.ts
```

## Expected Output

```
=== CAM MCP Gateway Demo ===

Initializing gateway with 2 MCP servers...
  - server-a: filesystem (trusted)
  - server-b: websearch (standard)

Registering tools...
  - server-a:search (trusted, cost: 0.001)
  - server-b:search (standard, cost: 0.002)

--- Test 1: Basic Routing ---
Request: search for "quarterly report"
Decision: server-a:search selected
Reason: Higher trust tier + lower cost
Trace ID: abc-123-...

--- Test 2: Policy Enforcement ---
Request: search with PII data classification
Decision: DENIED
Reason: Policy 'no-pii-external' blocked request
Trace ID: def-456-...

--- Test 3: Preferred Server ---
Request: search with preferred server = server-b
Decision: server-b:search selected
Reason: User preference honored (within policy)
Trace ID: ghi-789-...

Audit Log (3 records):
  [abc-123] tool_call -> server-a:search (success)
  [def-456] tool_call -> DENIED (policy)
  [ghi-789] tool_call -> server-b:search (success)
```

## How It Works

```
┌─────────────────────────────────────────────┐
│              CAM MCP Gateway                │
│                                             │
│  1. Receive tool call request               │
│  2. Find matching tools across servers      │
│  3. Apply policies (deny/allow)             │
│  4. Score remaining tools                   │
│  5. Select best tool                        │
│  6. Execute via MCP client                  │
│  7. Record audit log                        │
│  8. Return result with trace ID             │
└─────────────────────────────────────────────┘
```

## Configuration

See `demo.ts` for the full configuration including:

- Server definitions (transport, trust tier, cost)
- Policies (conditions, actions)
- Rate limits
- Audit settings

## Next Steps

- Add real MCP servers (replace mock clients)
- Export audit logs to your SIEM
- Add OpenTelemetry spans for distributed tracing
- Configure custom policies for your org
