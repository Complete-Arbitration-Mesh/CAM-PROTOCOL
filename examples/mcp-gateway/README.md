# CAM MCP Gateway Example

This example demonstrates the CAM MCP Gateway - a policy enforcement and routing layer for Model Context Protocol (MCP) servers.

## What's Included

| File | Description |
|------|-------------|
| `demo.ts` | Simple demo showing routing, policy enforcement, and audit logging |
| `gateway-server.ts` | Full HTTP server exposing the gateway as an API |
| `e2e-test.ts` | E2E test demonstrating cheap/fast routing and policy denial |
| `servers/fast-server.ts` | Toy MCP server simulating fast/expensive operations |
| `servers/cheap-server.ts` | Toy MCP server simulating slow/cheap operations |
| `docker-compose.yml` | Complete stack with Jaeger tracing and Grafana dashboards |
| `config/` | Configuration for Prometheus and Grafana |

## Quick Start

### Option 1: Run the E2E Test

Demonstrates three routing scenarios:
1. **Cheap route** - Cost optimization selects budget server
2. **Fast route** - Preference selects premium server
3. **Policy deny** - Admin tools blocked by policy

```bash
# From the repository root
npm run build
npm run test:mcp:demo
```

Expected output shows trace IDs, server selection, and audit verification.

### Option 2: Run with Vitest

```bash
npm run test:mcp
```

### Option 3: Run with Docker

```bash
cd examples/mcp-gateway

# Start the full stack
docker-compose up -d

# View logs
docker-compose logs -f gateway

# Access services:
#   Gateway API: http://localhost:8080
#   Jaeger UI:   http://localhost:16686
#   Grafana:     http://localhost:3000
```

## API Endpoints

The gateway-server exposes these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/tools` | GET | List available tools |
| `/call` | POST | Call a tool |
| `/audit` | GET | Get audit log |
| `/stats` | GET | Gateway statistics |
| `/policies` | GET | List policies |

### Example: Call a Tool

```bash
curl -X POST http://localhost:8080/call \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: my-tenant" \
  -d '{
    "toolName": "search",
    "arguments": {"query": "test"},
    "tenantId": "my-tenant"
  }'
```

### Example: View Audit Log

```bash
curl "http://localhost:8080/audit?tenantId=my-tenant&limit=10"
```

## Toy MCP Servers

Two toy servers demonstrate routing scenarios:

### Fast Server (`servers/fast-server.ts`)
- Simulated latency: 10-50ms
- Cost per call: $0.05
- Trust tier: Trusted
- Tools: `search`, `calculate`, `admin_reset`

### Cheap Server (`servers/cheap-server.ts`)
- Simulated latency: 200-500ms
- Cost per call: $0.001
- Trust tier: Standard
- Tools: `search`, `calculate`, `weather`

Both expose overlapping tools (`search`, `calculate`) to demonstrate routing.

## Routing Behavior

CAM selects the best tool based on scoring:

1. **Trust tier bonus**: Privileged > Trusted > Standard > Untrusted
2. **Cost penalty**: Lower cost = higher score
3. **Latency penalty**: Lower latency = higher score
4. **Preferred server bonus**: +25 points if matching

### Routing by Cost

Set `maxCost` to filter expensive tools:

```typescript
const result = await gateway.callTool({
  toolName: 'search',
  arguments: { query: 'test' },
  tenantId: 'customer',
  context: {
    maxCost: 0.01,  // Only tools under $0.01
  },
});
// → Routes to cheap-server
```

### Routing by Preference

Set `preferredServer` to favor a specific server:

```typescript
const result = await gateway.callTool({
  toolName: 'search',
  arguments: { query: 'test' },
  tenantId: 'customer',
  context: {
    preferredServer: 'fast',
  },
});
// → Routes to fast-server
```

## Policy Configuration

The example includes a policy blocking admin tools:

```typescript
{
  id: 'block-admin-tools',
  name: 'Block Administrative Tools',
  priority: 100,
  enabled: true,
  conditions: [
    { field: 'tool.name', operator: 'matches', value: '^admin_' },
  ],
  actions: ['deny'],
}
```

See [Policy Templates](../../docs/guides/policy-templates.md) for more examples.

## Audit Output

With `audit.outputPath` configured, each call writes to a JSONL file:

```jsonl
{"traceId":"abc-123","tenantId":"customer","action":"tool_call","request":{"toolName":"search"},"decision":{"allowed":true,"selectedTool":{"id":"cheap:search"}},"result":{"success":true,"latencyMs":250}}
```

## Observability

### Jaeger Tracing

With OTel enabled, all tool calls are traced. View traces at `http://localhost:16686`:

1. Select "cam-mcp-gateway" from the Service dropdown
2. Click "Find Traces"
3. Click on a trace to see the full span tree

### Grafana Dashboards

Access Grafana at `http://localhost:3000` (no login required):

- Pre-configured with Prometheus and Jaeger datasources
- Create dashboards to visualize request rates, latencies, errors

## How It Works

```
Request → Rate Limit Check → Find Matching Tools → Apply Policies
                                     ↓
                              Score & Select Best Tool
                                     ↓
                              Execute via MCP Client
                                     ↓
                              Record Audit → Return Result
```

## Cleanup

```bash
docker-compose down -v
```

## See Also

- [How CAM Complements MCP](../../docs/mcp/COMPLEMENTARY.md) - Philosophy and use cases
- [MCP Gateway v0.1 Documentation](../../docs/mcp/MCP-GATEWAY-v0.1.md) - Technical reference
- [OpenTelemetry Guide](../../docs/guides/mcp-opentelemetry.md) - Tracing setup
- [Policy Templates](../../docs/guides/policy-templates.md) - Example policies
