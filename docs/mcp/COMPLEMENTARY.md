# How CAM Complements MCP

## Philosophy

**CAM is not a replacement for MCP.** The Model Context Protocol (MCP) provides excellent tool and data connectivity. CAM sits **above** MCP as a governance layer, adding enterprise capabilities that MCP intentionally leaves out of scope.

Think of it this way:
- **MCP** = The protocol for connecting AI to tools (like HTTP for web)
- **CAM** = The policy, routing, and audit layer (like a reverse proxy + WAF)

## The Layers

```
┌─────────────────────────────────────────────────────┐
│              Your AI Application                     │
│         (Claude, GPT, Gemini, custom agents)        │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                  CAM Gateway                         │  ← Governance Layer
│  • Policy enforcement                               │
│  • Trust-tier filtering                             │
│  • Cost/latency arbitration                         │
│  • Rate limiting                                    │
│  • Audit logging (JSONL)                            │
│  • OpenTelemetry traces                             │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│            MCP Protocol Layer                        │  ← Connectivity Layer
│  • Tool discovery                                   │
│  • JSON-RPC transport (stdio, SSE)                  │
│  • Schema validation                                │
│  • Server connections                               │
└─────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌─────────┐     ┌─────────┐     ┌─────────┐
    │ MCP     │     │ MCP     │     │ MCP     │
    │Server A │     │Server B │     │Server C │
    └─────────┘     └─────────┘     └─────────┘
```

## What MCP Provides

MCP excels at:

| Capability | Description |
|------------|-------------|
| **Tool Discovery** | Servers expose tools with JSON schemas |
| **Transport** | stdio for local, SSE for remote connections |
| **Invocation** | JSON-RPC calls with typed arguments |
| **Resources** | Read-only data access patterns |
| **Prompts** | Template-based prompt construction |

MCP is **intentionally minimal** - it defines how to connect, not how to govern.

## What CAM Adds

CAM provides enterprise governance that MCP leaves to implementations:

| CAM Feature | Why It Matters |
|-------------|----------------|
| **Policy Engine** | Block tools by pattern, tenant, data classification |
| **Trust Tiers** | Untrusted → Standard → Trusted → Privileged |
| **Arbitration** | Select best tool when multiple servers offer the same capability |
| **Cost Routing** | Choose cheaper server when latency isn't critical |
| **Rate Limiting** | Per-tenant, per-tool throttling |
| **Audit Logs** | JSONL records of every decision for compliance |
| **Traces** | OpenTelemetry spans for observability |

## Use Case Examples

### Example 1: Multi-Tenant SaaS

You have a SaaS product with multiple customers. Each customer should only access their own data.

**Without CAM:**
- You implement tenant isolation in each MCP server
- Audit logging is scattered across servers
- No centralized view of who accessed what

**With CAM:**
- Gateway enforces tenant isolation via policies
- Single audit log shows all access
- Rate limiting prevents any tenant from monopolizing resources

### Example 2: Cost Optimization

You have two MCP servers providing the same tools - one fast/expensive, one slow/cheap.

**Without CAM:**
- Application must know about both servers
- Routing logic scattered in application code
- No visibility into cost savings

**With CAM:**
- Gateway discovers tools from both servers
- Routes to cheaper server when `maxCost` constraint is set
- Audit log shows cost savings per request

### Example 3: Security Compliance

Enterprise security requires logging all tool invocations with certain data.

**Without CAM:**
- Each MCP server must implement audit logging
- Inconsistent log formats across servers
- No centralized policy enforcement

**With CAM:**
- Single policy blocks tools matching sensitive patterns
- All decisions logged in JSONL format
- OpenTelemetry traces for incident investigation

## When to Use CAM vs. Direct MCP

| Scenario | Use Direct MCP | Use CAM Gateway |
|----------|----------------|-----------------|
| Single MCP server, single user | ✅ | Overkill |
| Multiple servers, no governance needs | ✅ | Optional |
| Multi-tenant access control | ❌ | ✅ |
| Compliance/audit requirements | ❌ | ✅ |
| Cost optimization across providers | ❌ | ✅ |
| Centralized observability | ❌ | ✅ |

## Integration Pattern

CAM integrates with your existing MCP servers - no changes required to the servers themselves.

```typescript
import { MCPGateway } from '@cam-protocol/complete-arbitration-mesh/mcp';

const gateway = new MCPGateway({
  servers: [
    // Point to your existing MCP servers
    { id: 'existing', command: 'your-mcp-server', /* ... */ },
    { id: 'another', command: 'another-server', /* ... */ },
  ],
  policies: [
    // Add governance policies
    { id: 'audit-all', actions: ['audit'] },
  ],
  audit: {
    enabled: true,
    outputPath: './audit.jsonl',
  },
});

// Use gateway instead of connecting to servers directly
const result = await gateway.callTool({
  toolName: 'my-tool',
  arguments: { /* ... */ },
  tenantId: 'customer-123',
});
```

## Summary

| Question | Answer |
|----------|--------|
| Does CAM replace MCP? | **No** - CAM uses MCP for connectivity |
| Can I use CAM without MCP servers? | **No** - CAM routes to MCP servers |
| Do MCP servers need changes? | **No** - CAM connects to standard MCP servers |
| What does CAM add? | Policies, arbitration, audit, observability |

## Learn More

- [MCP Gateway v0.1 Documentation](./MCP-GATEWAY-v0.1.md) - Technical reference
- [MCP Gateway Example](../../examples/mcp-gateway/) - Working demo
- [Policy Templates](../guides/policy-templates.md) - Example policies
- [OpenTelemetry Guide](../guides/mcp-opentelemetry.md) - Tracing setup
