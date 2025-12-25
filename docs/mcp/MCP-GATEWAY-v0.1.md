# MCP Gateway Mode v0.1

**Status:** Preview Release
**Protocol Version:** 2025-11-25 (also supports 2025-06-18)
**Release Date:** December 2025

## Overview

CAM MCP Gateway Mode provides an enterprise-grade arbitration, policy, and audit layer that sits **above** MCP (Model Context Protocol) servers. While MCP handles tool and data connectivity, CAM adds governance, intelligent routing, and observability.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Your AI Application                       │
└───────────────────────────────┬─────────────────────────────────┘
                                │ Single API
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAM MCP Gateway                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Policies   │  │  Arbitration │  │    Audit     │          │
│  │  Trust Tiers │  │   Scoring    │  │   JSONL Log  │          │
│  │  Rate Limits │  │  Cost/Speed  │  │  OTel Traces │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└───────────────────────────────┬─────────────────────────────────┘
                                │ stdio/SSE
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  MCP Server A   │   │  MCP Server B   │   │  MCP Server C   │
│   (Fast/$$)     │   │  (Cheap/Slow)   │   │  (Specialized)  │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## How CAM Complements MCP

| MCP Provides | CAM Adds |
|--------------|----------|
| Tool discovery | **Policy-based tool filtering** |
| Server connections | **Trust tier enforcement** |
| Tool execution | **Cost/latency arbitration** |
| — | **Audit logging (JSONL + stdout)** |
| — | **Rate limiting per tenant** |
| — | **Data classification filtering** |
| — | **OpenTelemetry traces** |

## Quick Start

### 1. Install

```bash
npm install @cam-protocol/complete-arbitration-mesh
```

### 2. Configure Gateway

```typescript
import { MCPGateway } from '@cam-protocol/complete-arbitration-mesh/mcp';

const gateway = new MCPGateway({
  servers: [
    {
      id: 'fast',
      name: 'Fast Premium Server',
      transport: 'stdio',
      command: 'npx',
      args: ['mcp-server-fast'],
      trustTier: 'trusted',
      costPerCall: 0.05,
      protocolVersion: '2025-11-25', // Optional, defaults to latest
      enabled: true,
    },
    {
      id: 'cheap',
      name: 'Budget Server',
      transport: 'stdio',
      command: 'npx',
      args: ['mcp-server-cheap'],
      trustTier: 'standard',
      costPerCall: 0.001,
      enabled: true,
    },
  ],
  policies: [
    {
      id: 'block-admin',
      name: 'Block Admin Tools',
      description: 'Prevent admin operations',
      priority: 100,
      enabled: true,
      conditions: [
        { field: 'tool.name', operator: 'matches', value: '^admin_' },
      ],
      actions: ['deny'],
    },
  ],
  defaults: {
    timeout: 30000,
    maxRetries: 3,
    retryDelayMs: 1000,
    defaultTrustTier: 'standard',
    protocolVersion: '2025-11-25',
  },
  audit: {
    enabled: true,
    retentionDays: 30,
    includeArguments: true,
    includeResults: false,
    outputPath: './audit.jsonl', // JSONL file output
  },
  rateLimit: {
    enabled: true,
    requestsPerMinute: 100,
  },
  otel: {
    enabled: true,
    serviceName: 'my-mcp-gateway',
    exporterUrl: 'http://localhost:4318/v1/traces',
  },
});

await gateway.initialize();
```

### 3. Call Tools

```typescript
// CAM automatically selects the best server based on:
// - Cost constraints (maxCost)
// - Preferred server
// - Trust tier requirements
// - Policy rules

const result = await gateway.callTool({
  toolName: 'search',
  arguments: { query: 'latest news' },
  tenantId: 'customer-123',
  userId: 'user-456',
  context: {
    maxCost: 0.01,        // Only use cheap servers
    preferredServer: 'fast', // Or prefer a specific server
  },
});

console.log(result.traceId);    // Audit trace ID
console.log(result.serverId);   // Which server was used
console.log(result.latencyMs);  // Response time
```

### 4. Streaming (Optional)

```typescript
for await (const event of gateway.callToolStreaming(request)) {
  switch (event.type) {
    case 'started':
      console.log('Tool call started:', event.traceId);
      break;
    case 'policy_evaluated':
      console.log('Policy:', event.policyId, event.allowed);
      break;
    case 'tool_selected':
      console.log('Selected:', event.toolId, 'on', event.serverId);
      break;
    case 'completed':
      console.log('Result:', event.result);
      break;
    case 'error':
      console.error('Error:', event.error);
      break;
  }
}
```

## Policy Engine

### Policy Structure

```typescript
interface MCPPolicy {
  id: string;
  name: string;
  description: string;
  priority: number;      // Higher = evaluated first
  enabled: boolean;
  conditions: PolicyCondition[];
  actions: PolicyActionType[];
}
```

### Condition Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `{ field: 'tool.trustTier', operator: 'eq', value: 'trusted' }` |
| `neq` | Not equals | `{ field: 'tool.trustTier', operator: 'neq', value: 'untrusted' }` |
| `in` | In array | `{ field: 'request.tenantId', operator: 'in', value: ['a', 'b'] }` |
| `notIn` | Not in array | `{ field: 'tool.tags', operator: 'notIn', value: ['admin'] }` |
| `gt` | Greater than | `{ field: 'tool.costEstimate', operator: 'gt', value: 0.01 }` |
| `lt` | Less than | `{ field: 'tool.costEstimate', operator: 'lt', value: 0.001 }` |
| `contains` | Array contains | `{ field: 'tool.dataClassifications', operator: 'contains', value: 'pii' }` |
| `matches` | Regex match | `{ field: 'tool.name', operator: 'matches', value: '^admin_' }` |

### Policy Actions

| Action | Description |
|--------|-------------|
| `allow` | Explicitly allow (bypasses later policies) |
| `deny` | Block the request |
| `log` | Log the request |
| `alert` | Send an alert |
| `redact` | Redact sensitive data from audit |
| `rateLimit` | Apply rate limiting |
| `requireApproval` | Require human approval |

### Example Policies

See [Policy Templates](../guides/policy-templates.md) for pre-built policies covering:
- Data protection (PII, PHI, confidential)
- Cost control (tier-based limits)
- Access control (admin tools, user ID requirements)
- Audit and compliance

## Audit Logging

### JSONL Output

When `audit.outputPath` is configured, each tool call writes a JSON line:

```jsonl
{"traceId":"abc-123","timestamp":"2025-12-25T12:00:00Z","tenantId":"customer-1","action":"tool_call","request":{"toolName":"search","arguments":{"query":"test"}},"decision":{"allowed":true,"selectedTool":{"id":"cheap:search","serverId":"cheap","toolName":"search","trustTier":"standard","costEstimate":0.001},"reason":"Tool selected by arbitration"},"result":{"success":true,"latencyMs":250}}
```

### Stdout Logging

All audit records are also logged to stdout as structured JSON for log aggregation:

```json
{"level":"info","msg":"AUDIT","traceId":"abc-123","tenantId":"customer-1","toolName":"search","allowed":true,"selectedTool":"cheap:search","latencyMs":250}
```

## OpenTelemetry Integration

Enable tracing to see the full request flow:

```typescript
otel: {
  enabled: true,
  serviceName: 'cam-mcp-gateway',
  serviceVersion: '2.1.0',
  exporterUrl: 'http://localhost:4318/v1/traces',
}
```

### Trace Attributes

| Attribute | Description |
|-----------|-------------|
| `cam.tenant_id` | Requesting tenant |
| `cam.user_id` | Requesting user |
| `cam.tool_name` | Tool being called |
| `cam.server_id` | Selected MCP server |
| `cam.decision` | Arbitration decision |
| `cam.latency_ms` | Total latency |

See [OpenTelemetry Guide](../guides/mcp-opentelemetry.md) for Jaeger/Grafana setup.

## Protocol Version Pinning

Configure which MCP protocol version to use:

```typescript
{
  id: 'my-server',
  protocolVersion: '2025-11-25', // or '2025-06-18'
  // ...
}
```

The gateway logs the protocol version when connecting:

```
INFO Connecting to MCP server: my-server {"transport":"stdio","protocolVersion":"2025-11-25"}
```

## Running the Example

```bash
# Clone the repository
git clone https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL.git
cd CAM-PROTOCOL

# Install dependencies
npm install

# Build
npm run build

# Run the E2E demo (requires tsx in PATH)
npm run test:mcp:demo

# Or run the vitest tests
npm run test:mcp
```

### Docker Compose

```bash
cd examples/mcp-gateway
docker-compose up -d

# Services:
#   Gateway: http://localhost:8080
#   Jaeger:  http://localhost:16686
#   Grafana: http://localhost:3000
```

## API Reference

### MCPGateway

```typescript
class MCPGateway {
  constructor(config: MCPGatewayConfig);

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;

  // Tool calls
  callTool(request: ToolCallRequest): Promise<ToolCallResult>;
  callToolStreaming(request: ToolCallRequest): AsyncGenerator<ToolCallStreamEvent>;

  // Policies
  addPolicy(policy: MCPPolicy): void;
  removePolicy(policyId: string): void;
  getPolicies(): MCPPolicy[];

  // Audit
  getAuditLog(filter?: AuditFilter): AuditRecord[];

  // Stats
  getStats(): GatewayStats;
  getRegistry(): MCPToolRegistry;

  // Events
  onEvent(handler: (event: MCPGatewayEvent) => void): void;
}
```

### ToolCallRequest

```typescript
interface ToolCallRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  tenantId: string;
  userId?: string;
  context?: {
    intent?: string;
    maxCost?: number;
    maxLatency?: number;
    requiredDataClass?: DataClassification;
    preferredServer?: string;
  };
}
```

### ToolCallResult

```typescript
interface ToolCallResult {
  traceId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  serverId: string;
  toolId: string;
  latencyMs: number;
  cost: number;
  policyActions: PolicyAction[];
  timestamp: Date;
}
```

## Limitations (v0.1)

- **No HTTP Transport for Servers:** Currently supports stdio and SSE only
- **Simple Rate Limiting:** Per-tenant only, no per-tool limits
- **In-Memory Audit:** Audit log is also stored in memory; use JSONL for persistence
- **No Approval Workflow:** `requireApproval` action logs but doesn't block

## Roadmap

### v0.2 (Planned)
- HTTP transport for MCP servers
- Per-tool rate limiting
- Approval workflow integration
- Redis-backed audit storage

### v1.0 (Future)
- Multi-region gateway support
- Advanced routing algorithms
- Policy expression language
- Admin UI

## See Also

- [How CAM Complements MCP](./COMPLEMENTARY.md) - Philosophy and use cases
- [Policy Templates](../guides/policy-templates.md) - Example policies
- [OpenTelemetry Guide](../guides/mcp-opentelemetry.md) - Tracing setup
- [MCP Gateway Example](../../examples/mcp-gateway/) - Working demo
- [MCP Official Documentation](https://modelcontextprotocol.io/) - MCP spec
