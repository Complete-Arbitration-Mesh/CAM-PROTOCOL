# CAM as MCP Enhancement Layer

**Date**: 2025-12-25
**Status**: Strategic Direction
**Author**: Andrew "Dru" Edwards

---

## Strategic Position

CAM should **complement MCP, not compete with it**.

- **MCP** = The connector protocol (tool/data connectivity)
- **CAM** = The policy + arbitration + routing brain above MCP

> "Standards are mostly a social club. The way you win is by being the thing that makes the club useful in real life."

---

## What MCP Doesn't Do (CAM's Opportunity)

| Gap | CAM Solution |
|-----|--------------|
| Cross-server arbitration | Route to optimal MCP server based on cost/latency/risk |
| Global policy governance | RBAC, quotas, data classification across all MCP servers |
| Reliability engineering | Timeouts, retries, circuit breaking, failover |
| Audit-grade traces | Decision logs suitable for SOC2/HIPAA evidence |
| Billing metering | Track usage and costs across MCP ecosystem |

---

## Architecture: CAM as MCP Policy Gateway

```
┌─────────────────────────────────────────────────────────────┐
│                     LLM Host / Agent                         │
│              (Claude, OpenAI Agents, IDEs)                   │
└─────────────────────────┬───────────────────────────────────┘
                          │ MCP Protocol
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    CAM MCP Gateway                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Policy    │  │ Arbitration │  │  Reliability │         │
│  │   Engine    │  │   Engine    │  │   Layer      │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │    Audit    │  │   Billing   │  │  Tool       │         │
│  │    Logger   │  │   Metering  │  │  Registry   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────┬───────────────────────────────────┘
                          │ MCP Protocol (fan-out)
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │MCP Server│    │MCP Server│    │MCP Server│
    │  (Code)  │    │  (Data)  │    │ (Search) │
    └──────────┘    └──────────┘    └──────────┘
```

---

## Implementation Phases

### Phase 1: MCP Compatibility Layer (Hard Requirement)

**Deliverables:**
- [ ] MCP Client module: connect to MCP servers (stdio/SSE)
- [ ] List tools/resources/prompts from connected servers
- [ ] Invoke tools and handle streaming responses
- [ ] Schema + version negotiation (pin supported MCP spec version)
- [ ] Conformance tests against MCP reference tooling

**Why**: Without this, "we complement MCP" is just marketing.

### Phase 2: Arbitration Over MCP (The Moat)

**Tool Registry:**
- Normalize tool metadata from multiple MCP servers
- Handle name collisions with namespacing
- Tag capabilities, cost estimates, trust tiers, data classification

**Arbitration Engine Inputs:**
- User intent
- Required data classification (PII/PHI handling)
- Cost ceiling
- Latency SLO
- Tool trust tier
- Tenant policy

**Decision Output:**
- Selected MCP server + tool
- Call plan
- Rationale
- Policy references
- Trace ID

**Minimum Policies:**
- [ ] Allow/deny by tenant, role, data class
- [ ] Budget caps and rate limits per tenant
- [ ] "Trusted tool only" mode
- [ ] Redaction rules for tool outputs
- [ ] Tool sandboxing (deny code-exec unless explicitly allowed)

### Phase 3: Reliability Engineering

- [ ] Circuit breakers per MCP server
- [ ] Timeout/retry/backoff policies
- [ ] Fallback routing (tool A fails → tool B)
- [ ] Deterministic degradation (partial results with flags)

### Phase 4: Observability (OpenTelemetry)

Emit OTel traces/metrics/logs for:
- Host request received
- Arbitration decision made
- MCP tool call(s) executed
- Results returned
- Policy actions applied

Include:
- [ ] Ready-to-run collector config
- [ ] Dashboard templates (Grafana)
- [ ] Alert rules

### Phase 5: MCP Enhancement Pack (Demos)

Three practical demos:

1. **Multi-MCP Routing**: Two servers expose similar tools, CAM chooses by latency/cost
2. **Policy Enforcement**: User tries restricted tool, CAM blocks and logs why
3. **Audit Export**: Produce SOC2/HIPAA-ready audit records

---

## Risks and Mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Accidentally reinvent MCP | High | Draw bright line in docs: MCP = connectivity, CAM = governance |
| Spec drift breaks integration | Medium | Lock supported versions, CI conformance, compatibility matrix |
| Licensing ambiguity kills adoption | High | Clear OSS core license, separate enterprise modules |

---

## Milestone: CAM MCP Gateway v0.1

**Acceptance Tests:**

1. ✅ Connect to 2+ MCP servers, aggregate tool catalogs, invoke tools reliably
2. ✅ Enforce one tenant policy (deny restricted tool) and produce audit record
3. ✅ Emit OTel traces end-to-end and view in collector pipeline

---

## Existing CAM Assets to Leverage

| Component | Reusable For |
|-----------|--------------|
| `fastpath-router.ts` | Arbitration logic, provider selection |
| `rate-limiter.ts` | Per-tenant rate limits |
| `cache-manager.ts` | Tool response caching |
| `auth-service.ts` | Tenant authentication |
| `state-manager.ts` | Tool registry persistence |
| Policy framework | MCP tool policies |
| Monitoring setup | OTel integration base |

---

## Next Steps

1. Research MCP SDK/spec (official TypeScript SDK exists)
2. Create `src/mcp/` module structure
3. Implement basic MCP client connection
4. Build tool registry aggregation
5. Wire arbitration engine to MCP tools
