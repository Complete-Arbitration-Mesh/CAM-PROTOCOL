/**
 * CAM MCP Gateway Demo
 *
 * Demonstrates CAM as a governance layer above MCP servers.
 * Uses mock MCP servers to show routing, policy enforcement, and audit.
 */

import { randomUUID } from "crypto";

// Types (simplified from src/mcp/types.ts)
interface MockTool {
  name: string;
  description: string;
}

interface MockServer {
  id: string;
  name: string;
  trustTier: "untrusted" | "standard" | "trusted" | "privileged";
  costPerCall: number;
  tools: MockTool[];
  dataClassifications: string[];
}

interface Policy {
  id: string;
  name: string;
  priority: number;
  conditions: { field: string; operator: string; value: unknown }[];
  actions: string[];
}

interface AuditRecord {
  traceId: string;
  timestamp: Date;
  tenantId: string;
  toolName: string;
  serverId: string;
  decision: "allowed" | "denied";
  reason: string;
}

// Mock MCP Servers
const servers: MockServer[] = [
  {
    id: "server-a",
    name: "filesystem",
    trustTier: "trusted",
    costPerCall: 0.001,
    tools: [
      { name: "search", description: "Search files on disk" },
      { name: "read_file", description: "Read file contents" },
    ],
    dataClassifications: ["internal"],
  },
  {
    id: "server-b",
    name: "websearch",
    trustTier: "standard",
    costPerCall: 0.002,
    tools: [
      { name: "search", description: "Search the web" },
      { name: "fetch_url", description: "Fetch URL contents" },
    ],
    dataClassifications: ["public"],
  },
];

// Policies
const policies: Policy[] = [
  {
    id: "no-pii-external",
    name: "Block PII to external tools",
    priority: 100,
    conditions: [
      { field: "request.dataClassification", operator: "eq", value: "pii" },
      { field: "tool.trustTier", operator: "neq", value: "privileged" },
    ],
    actions: ["deny"],
  },
];

// Audit log
const auditLog: AuditRecord[] = [];

// Gateway logic
function findMatchingTools(toolName: string) {
  const matches: { server: MockServer; tool: MockTool }[] = [];
  for (const server of servers) {
    for (const tool of server.tools) {
      if (tool.name === toolName) {
        matches.push({ server, tool });
      }
    }
  }
  return matches;
}

function evaluatePolicy(
  policy: Policy,
  request: { dataClassification?: string },
  server: MockServer
): boolean {
  for (const condition of policy.conditions) {
    if (condition.field === "request.dataClassification") {
      if (condition.operator === "eq" && request.dataClassification !== condition.value) {
        return false; // Condition not met
      }
    }
    if (condition.field === "tool.trustTier") {
      if (condition.operator === "neq" && server.trustTier === condition.value) {
        return false; // Condition not met
      }
    }
  }
  return true; // All conditions met
}

function scoreTool(server: MockServer, preferredServer?: string): number {
  let score = 100;

  // Trust tier bonus
  const trustBonus: Record<string, number> = {
    privileged: 20,
    trusted: 15,
    standard: 10,
    untrusted: 0,
  };
  score += trustBonus[server.trustTier] || 0;

  // Cost penalty
  score -= server.costPerCall * 1000;

  // Preferred server bonus
  if (preferredServer === server.id) {
    score += 25;
  }

  return score;
}

interface GatewayRequest {
  toolName: string;
  tenantId: string;
  dataClassification?: string;
  preferredServer?: string;
}

interface GatewayResult {
  success: boolean;
  traceId: string;
  serverId?: string;
  toolId?: string;
  reason: string;
}

function callTool(request: GatewayRequest): GatewayResult {
  const traceId = randomUUID().slice(0, 8);

  // Find matching tools
  const candidates = findMatchingTools(request.toolName);
  if (candidates.length === 0) {
    const result = {
      success: false,
      traceId,
      reason: `No tool found: ${request.toolName}`,
    };
    auditLog.push({
      traceId,
      timestamp: new Date(),
      tenantId: request.tenantId,
      toolName: request.toolName,
      serverId: "none",
      decision: "denied",
      reason: result.reason,
    });
    return result;
  }

  // Apply policies
  const allowedCandidates: { server: MockServer; tool: MockTool }[] = [];
  let deniedReason = "";

  for (const { server, tool } of candidates) {
    let blocked = false;
    for (const policy of policies) {
      if (evaluatePolicy(policy, request, server)) {
        if (policy.actions.includes("deny")) {
          blocked = true;
          deniedReason = `Policy '${policy.id}' blocked request`;
          break;
        }
      }
    }
    if (!blocked) {
      allowedCandidates.push({ server, tool });
    }
  }

  if (allowedCandidates.length === 0) {
    const result = {
      success: false,
      traceId,
      reason: deniedReason || "All tools blocked by policy",
    };
    auditLog.push({
      traceId,
      timestamp: new Date(),
      tenantId: request.tenantId,
      toolName: request.toolName,
      serverId: "policy",
      decision: "denied",
      reason: result.reason,
    });
    return result;
  }

  // Score and select best
  const scored = allowedCandidates.map(({ server, tool }) => ({
    server,
    tool,
    score: scoreTool(server, request.preferredServer),
  }));
  scored.sort((a, b) => b.score - a.score);

  const selected = scored[0];
  if (!selected) {
    return {
      success: false,
      traceId,
      reason: "No tools available after scoring",
    };
  }

  const result = {
    success: true,
    traceId,
    serverId: selected.server.id,
    toolId: `${selected.server.id}:${selected.tool.name}`,
    reason: "Tool selected by arbitration",
  };

  auditLog.push({
    traceId,
    timestamp: new Date(),
    tenantId: request.tenantId,
    toolName: request.toolName,
    serverId: selected.server.id,
    decision: "allowed",
    reason: result.reason,
  });

  return result;
}

// Demo execution
console.log("=== CAM MCP Gateway Demo ===\n");

console.log("Initializing gateway with 2 MCP servers...");
for (const server of servers) {
  console.log(`  - ${server.id}: ${server.name} (${server.trustTier})`);
}

console.log("\nRegistering tools...");
for (const server of servers) {
  for (const tool of server.tools) {
    console.log(`  - ${server.id}:${tool.name} (${server.trustTier}, cost: ${server.costPerCall})`);
  }
}

console.log("\n--- Test 1: Basic Routing ---");
const result1 = callTool({
  toolName: "search",
  tenantId: "tenant-123",
});
console.log(`Request: search for "quarterly report"`);
console.log(`Decision: ${result1.toolId || "DENIED"} selected`);
console.log(`Reason: ${result1.reason}`);
console.log(`Trace ID: ${result1.traceId}`);

console.log("\n--- Test 2: Policy Enforcement ---");
const result2 = callTool({
  toolName: "search",
  tenantId: "tenant-123",
  dataClassification: "pii",
});
console.log("Request: search with PII data classification");
console.log(`Decision: ${result2.success ? result2.toolId : "DENIED"}`);
console.log(`Reason: ${result2.reason}`);
console.log(`Trace ID: ${result2.traceId}`);

console.log("\n--- Test 3: Preferred Server ---");
const result3 = callTool({
  toolName: "search",
  tenantId: "tenant-123",
  preferredServer: "server-b",
});
console.log("Request: search with preferred server = server-b");
console.log(`Decision: ${result3.toolId || "DENIED"} selected`);
console.log(`Reason: ${result3.reason}`);
console.log(`Trace ID: ${result3.traceId}`);

console.log("\n--- Audit Log ---");
console.log(`${auditLog.length} records:`);
for (const record of auditLog) {
  console.log(
    `  [${record.traceId}] ${record.toolName} -> ${record.serverId} (${record.decision})`
  );
}

console.log("\n--- Audit Export (JSON) ---");
console.log(JSON.stringify(auditLog, null, 2));
