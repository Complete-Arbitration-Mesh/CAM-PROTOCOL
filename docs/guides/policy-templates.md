# MCP Gateway Policy Templates

Pre-built policy templates for common governance scenarios. Copy and customize these for your organization.

## Data Protection Policies

### Block PII to External Tools

Prevents personally identifiable information from being sent to untrusted or external tools.

```typescript
{
  id: "block-pii-external",
  name: "Block PII to External Tools",
  description: "Prevents PII from being processed by untrusted tools",
  priority: 100,  // High priority - evaluated first
  enabled: true,
  conditions: [
    { field: "tool.dataClassifications", operator: "contains", value: "pii" },
    { field: "tool.trustTier", operator: "in", value: ["untrusted", "standard"] },
  ],
  actions: ["deny"],
}
```

### Block PHI for Non-HIPAA Tools

Healthcare-specific policy for protected health information.

```typescript
{
  id: "block-phi-non-hipaa",
  name: "Block PHI to Non-HIPAA Compliant Tools",
  description: "Ensures PHI only goes to HIPAA-compliant tools",
  priority: 100,
  enabled: true,
  conditions: [
    { field: "tool.dataClassifications", operator: "contains", value: "phi" },
    { field: "tool.tags", operator: "notIn", value: ["hipaa-compliant"] },
  ],
  actions: ["deny"],
}
```

### Restrict Confidential Data

Limits confidential data to privileged tools only.

```typescript
{
  id: "restrict-confidential",
  name: "Restrict Confidential Data",
  description: "Only privileged tools can process confidential data",
  priority: 95,
  enabled: true,
  conditions: [
    { field: "tool.dataClassifications", operator: "contains", value: "confidential" },
    { field: "tool.trustTier", operator: "neq", value: "privileged" },
  ],
  actions: ["deny"],
}
```

## Cost Control Policies

### Block High-Cost Tools for Free Tier

Prevents expensive tools from being used by free-tier tenants.

```typescript
{
  id: "cost-limit-free-tier",
  name: "Cost Limit for Free Tier",
  description: "Blocks high-cost tools for free tier users",
  priority: 80,
  enabled: true,
  conditions: [
    { field: "tool.costEstimate", operator: "gt", value: 0.01 },
    { field: "request.tenantId", operator: "matches", value: "^free-.*" },
  ],
  actions: ["deny"],
}
```

### Warn on Expensive Operations

Logs a warning when expensive operations are used.

```typescript
{
  id: "warn-expensive-ops",
  name: "Warn on Expensive Operations",
  description: "Logs warnings for expensive tool calls",
  priority: 50,
  enabled: true,
  conditions: [
    { field: "tool.costEstimate", operator: "gt", value: 0.05 },
  ],
  actions: ["log", "alert"],
}
```

### Enterprise Cost Override

Allows enterprise tenants to bypass cost limits.

```typescript
{
  id: "enterprise-cost-override",
  name: "Enterprise Cost Override",
  description: "Allows enterprise tenants to use any tool regardless of cost",
  priority: 90,  // Higher than cost-limit policies
  enabled: true,
  conditions: [
    { field: "request.tenantId", operator: "in", value: ["enterprise-1", "enterprise-2"] },
  ],
  actions: ["allow"],  // Explicit allow bypasses other policies
}
```

## Access Control Policies

### Require User ID

Ensures all requests have a user ID for audit purposes.

```typescript
{
  id: "require-user-id",
  name: "Require User Identification",
  description: "All requests must include a user ID",
  priority: 100,
  enabled: true,
  conditions: [
    { field: "request.userId", operator: "eq", value: undefined },
  ],
  actions: ["deny"],
}
```

### Restrict Admin Tools

Limits administrative tools to specific tenants.

```typescript
{
  id: "restrict-admin-tools",
  name: "Restrict Administrative Tools",
  description: "Only admin tenants can use administrative tools",
  priority: 100,
  enabled: true,
  conditions: [
    { field: "tool.tags", operator: "contains", value: "admin" },
    { field: "request.tenantId", operator: "notIn", value: ["admin-tenant", "ops-tenant"] },
  ],
  actions: ["deny"],
}
```

### Block Destructive Operations

Prevents destructive operations without approval.

```typescript
{
  id: "block-destructive",
  name: "Block Destructive Operations",
  description: "Requires approval for destructive operations",
  priority: 100,
  enabled: true,
  conditions: [
    { field: "tool.tags", operator: "contains", value: "destructive" },
  ],
  actions: ["requireApproval"],
}
```

## Trust Tier Policies

### Prefer Trusted Tools

Adds scoring bonus for trusted tools (doesn't deny, just influences selection).

```typescript
{
  id: "prefer-trusted",
  name: "Prefer Trusted Tools",
  description: "Adds preference for trusted tools in arbitration",
  priority: 10,
  enabled: true,
  conditions: [
    { field: "tool.trustTier", operator: "eq", value: "trusted" },
  ],
  actions: ["log"],  // Just logs, scoring handles preference
}
```

### Block Untrusted in Production

Completely blocks untrusted tools in production environments.

```typescript
{
  id: "block-untrusted-prod",
  name: "Block Untrusted in Production",
  description: "Prevents untrusted tools from being used in production",
  priority: 100,
  enabled: process.env.NODE_ENV === "production",
  conditions: [
    { field: "tool.trustTier", operator: "eq", value: "untrusted" },
  ],
  actions: ["deny"],
}
```

## Rate Limiting Policies

### Limit Frequent Callers

Rate limits aggressive tool usage patterns.

```typescript
{
  id: "limit-frequent-callers",
  name: "Limit Frequent Tool Calls",
  description: "Rate limits users making excessive calls",
  priority: 90,
  enabled: true,
  conditions: [
    // Note: This is evaluated by the rate limiter, not policy engine
    // Include it for documentation purposes
  ],
  actions: ["rateLimit"],
}
```

## Audit & Compliance Policies

### Log All Tool Calls

Ensures all tool calls are logged for compliance.

```typescript
{
  id: "log-all-calls",
  name: "Log All Tool Calls",
  description: "Logs every tool call for audit trail",
  priority: 1,  // Low priority - runs last
  enabled: true,
  conditions: [],  // Matches everything
  actions: ["log"],
}
```

### Alert on Sensitive Access

Triggers alerts when sensitive tools are accessed.

```typescript
{
  id: "alert-sensitive",
  name: "Alert on Sensitive Tool Access",
  description: "Sends alerts when sensitive tools are used",
  priority: 50,
  enabled: true,
  conditions: [
    { field: "tool.tags", operator: "contains", value: "sensitive" },
  ],
  actions: ["log", "alert"],
}
```

### Redact Sensitive Arguments

Redacts sensitive information from audit logs.

```typescript
{
  id: "redact-sensitive-args",
  name: "Redact Sensitive Arguments",
  description: "Removes sensitive data from audit records",
  priority: 5,
  enabled: true,
  conditions: [
    { field: "tool.dataClassifications", operator: "contains", value: "pii" },
  ],
  actions: ["redact"],
}
```

## Complete Policy Set Example

A complete configuration combining multiple policies:

```typescript
const policies: MCPPolicy[] = [
  // Data Protection (highest priority)
  {
    id: "block-pii-external",
    name: "Block PII to External Tools",
    priority: 100,
    enabled: true,
    conditions: [
      { field: "tool.dataClassifications", operator: "contains", value: "pii" },
      { field: "tool.trustTier", operator: "neq", value: "privileged" },
    ],
    actions: ["deny"],
  },

  // Cost Control
  {
    id: "cost-limit-standard",
    name: "Cost Limit for Standard Users",
    priority: 80,
    enabled: true,
    conditions: [
      { field: "tool.costEstimate", operator: "gt", value: 0.01 },
      { field: "request.tenantId", operator: "notIn", value: ["enterprise-1"] },
    ],
    actions: ["deny"],
  },

  // Access Control
  {
    id: "require-user-id",
    name: "Require User ID",
    priority: 95,
    enabled: true,
    conditions: [
      { field: "request.userId", operator: "eq", value: undefined },
    ],
    actions: ["deny"],
  },

  // Audit (lowest priority)
  {
    id: "log-all",
    name: "Log All Calls",
    priority: 1,
    enabled: true,
    conditions: [],
    actions: ["log"],
  },
];
```

## Policy Operators Reference

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equals | `{ field: "tool.trustTier", operator: "eq", value: "trusted" }` |
| `neq` | Not equals | `{ field: "tool.trustTier", operator: "neq", value: "untrusted" }` |
| `in` | Value in array | `{ field: "request.tenantId", operator: "in", value: ["a", "b"] }` |
| `notIn` | Value not in array | `{ field: "tool.tags", operator: "notIn", value: ["admin"] }` |
| `gt` | Greater than | `{ field: "tool.costEstimate", operator: "gt", value: 0.01 }` |
| `lt` | Less than | `{ field: "tool.costEstimate", operator: "lt", value: 0.001 }` |
| `contains` | Array contains value | `{ field: "tool.tags", operator: "contains", value: "pii" }` |
| `matches` | Regex match | `{ field: "request.tenantId", operator: "matches", value: "^prod-.*" }` |

## Policy Actions Reference

| Action | Description |
|--------|-------------|
| `allow` | Explicitly allow (bypasses subsequent policies) |
| `deny` | Block the request |
| `log` | Log the request |
| `alert` | Send an alert |
| `redact` | Redact sensitive data from audit |
| `rateLimit` | Apply rate limiting |
| `requireApproval` | Require human approval |

## See Also

- [MCP Gateway Example](../../examples/mcp-gateway/)
- [Gateway Configuration](../configuration.md)
