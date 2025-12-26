/**
 * MCP Gateway Types
 *
 * Types for CAM's MCP integration layer.
 * CAM acts as a policy gateway that sits above MCP servers.
 */

import type {
  Tool,
  Resource,
  Prompt,
} from "@modelcontextprotocol/sdk/types.js";

// =========================================================================
// MCP Server Configuration
// =========================================================================

/**
 * Supported MCP protocol versions
 * - 2025-11-25: Latest stable (default)
 * - 2025-06-18: Previous stable
 */
export type MCPProtocolVersion = "2025-11-25" | "2025-06-18";

export interface MCPServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "sse" | "http";
  endpoint?: string; // For SSE/HTTP
  command?: string; // For stdio
  args?: string[]; // For stdio
  env?: Record<string, string>;
  trustTier: "untrusted" | "standard" | "trusted" | "privileged";
  dataClassifications?: DataClassification[];
  costPerCall?: number; // Estimated cost per tool invocation
  timeout?: number; // Connection timeout in ms
  protocolVersion?: MCPProtocolVersion; // MCP protocol version (default: 2025-11-25)
  enabled: boolean;
}

export type DataClassification =
  | "public"
  | "internal"
  | "confidential"
  | "pii"
  | "phi"
  | "restricted";

// =========================================================================
// Tool Registry
// =========================================================================

export interface RegisteredTool {
  id: string; // Unique ID: serverId:toolName
  serverId: string;
  tool: Tool;
  trustTier: "untrusted" | "standard" | "trusted" | "privileged";
  dataClassifications: DataClassification[];
  costEstimate: number;
  latencyP50?: number;
  latencyP95?: number;
  latencyP99?: number;
  latencies?: number[]; // Rolling window of recent latencies for percentile calculation
  successRate?: number;
  errorCount?: number;
  callCount: number;
  lastUsed?: Date;
  lastError?: string;
  lastErrorTime?: Date;
  tags: string[];
}

export interface RegisteredResource {
  id: string;
  serverId: string;
  resource: Resource;
  dataClassifications: DataClassification[];
}

export interface RegisteredPrompt {
  id: string;
  serverId: string;
  prompt: Prompt;
}

export interface ToolRegistry {
  tools: Map<string, RegisteredTool>;
  resources: Map<string, RegisteredResource>;
  prompts: Map<string, RegisteredPrompt>;
  servers: Map<string, MCPServerConnection>;
}

// =========================================================================
// Server Connection State
// =========================================================================

export interface MCPServerConnection {
  config: MCPServerConfig;
  status: "disconnected" | "connecting" | "connected" | "error";
  lastError?: string | undefined;
  lastConnected?: Date | undefined;
  toolCount: number;
  resourceCount: number;
  promptCount: number;
}

// =========================================================================
// Arbitration
// =========================================================================

export interface ToolCallRequest {
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

export interface ArbitrationDecision {
  allowed: boolean;
  selectedTool?: RegisteredTool | undefined;
  reason: string;
  policyReferences: string[];
  traceId: string;
  alternativeTools?: RegisteredTool[] | undefined;
  estimatedCost?: number | undefined;
  estimatedLatency?: number | undefined;
}

export interface ToolCallResult {
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

/**
 * Streaming tool call progress events
 */
export type ToolCallStreamEvent =
  | { type: "started"; traceId: string; toolName: string; timestamp: Date }
  | { type: "arbitrating"; traceId: string; candidateCount: number }
  | {
      type: "policy_evaluated";
      traceId: string;
      policyId: string;
      allowed: boolean;
    }
  | { type: "tool_selected"; traceId: string; toolId: string; serverId: string }
  | { type: "executing"; traceId: string; toolId: string }
  | { type: "completed"; traceId: string; result: ToolCallResult }
  | { type: "error"; traceId: string; error: string };

// =========================================================================
// Policies
// =========================================================================

export interface MCPPolicy {
  id: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  conditions: PolicyCondition[];
  actions: PolicyActionType[];
}

export interface PolicyCondition {
  field: string;
  operator:
    | "eq"
    | "neq"
    | "in"
    | "notIn"
    | "gt"
    | "lt"
    | "contains"
    | "matches";
  value: unknown;
}

export type PolicyActionType =
  | "allow"
  | "deny"
  | "redact"
  | "log"
  | "alert"
  | "rateLimit"
  | "requireApproval";

export interface PolicyAction {
  policyId: string;
  action: PolicyActionType;
  reason: string;
  timestamp: Date;
}

// =========================================================================
// Audit
// =========================================================================

export interface AuditRecord {
  traceId: string;
  timestamp: Date;
  tenantId: string;
  userId?: string | undefined;
  action: "tool_call" | "resource_access" | "prompt_use" | "policy_violation";
  request: {
    toolName?: string | undefined;
    resourceUri?: string | undefined;
    promptName?: string | undefined;
    arguments?: Record<string, unknown> | undefined;
  };
  decision: ArbitrationDecision;
  result?: ToolCallResult | undefined;
  policyActions: PolicyAction[];
  metadata?: Record<string, unknown> | undefined;
}

// =========================================================================
// Gateway Configuration
// =========================================================================

export interface MCPGatewayConfig {
  servers: MCPServerConfig[];
  policies: MCPPolicy[];
  defaults: {
    timeout: number;
    maxRetries: number;
    retryDelayMs: number;
    defaultTrustTier: "untrusted" | "standard" | "trusted" | "privileged";
    protocolVersion: MCPProtocolVersion; // Default MCP protocol version
  };
  audit: {
    enabled: boolean;
    retentionDays: number;
    includeArguments: boolean;
    includeResults: boolean;
    outputPath?: string; // Path for JSONL audit file (optional)
  };
  rateLimit: {
    enabled: boolean;
    requestsPerMinute: number;
    requestsPerMinuteByTenant?: Record<string, number>;
  };
  otel?: {
    enabled: boolean;
    serviceName?: string;
    serviceVersion?: string;
    exporterUrl?: string;
  };
}

// =========================================================================
// Events
// =========================================================================

export type MCPGatewayEvent =
  | { type: "server_connected"; serverId: string; toolCount: number }
  | { type: "server_disconnected"; serverId: string; reason: string }
  | { type: "server_error"; serverId: string; error: string }
  | { type: "tool_called"; traceId: string; toolId: string; success: boolean }
  | {
      type: "policy_violation";
      traceId: string;
      policyId: string;
      reason: string;
    }
  | { type: "rate_limited"; tenantId: string; limit: number };
