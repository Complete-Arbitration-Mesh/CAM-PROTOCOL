/**
 * MCP Gateway
 *
 * The policy + arbitration + routing brain that sits above MCP servers.
 * Provides governance, routing, auditing, and reliability for MCP deployments.
 */

import { randomUUID } from "crypto";
import { appendFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { Logger } from "../shared/logger.js";
import { MCPToolRegistry } from "./tool-registry.js";
import { RateLimiter } from "../routing/rate-limiter.js";
import {
  MCPOTelInstrumentation,
  createNoOpInstrumentation,
} from "./otel-instrumentation.js";
import type { Span } from "@opentelemetry/api";
import type {
  MCPGatewayConfig,
  MCPPolicy,
  ToolCallRequest,
  ArbitrationDecision,
  ToolCallResult,
  ToolCallStreamEvent,
  AuditRecord,
  PolicyAction,
  RegisteredTool,
  MCPGatewayEvent,
} from "./types.js";

export class MCPGateway {
  private registry: MCPToolRegistry;
  private rateLimiter: RateLimiter;
  private otel: MCPOTelInstrumentation;
  private policies: Map<string, MCPPolicy> = new Map();
  private auditLog: AuditRecord[] = [];
  private config: MCPGatewayConfig;
  private logger: Logger;
  private eventHandlers: ((event: MCPGatewayEvent) => void)[] = [];

  constructor(config: MCPGatewayConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger || new Logger("info");
    this.registry = new MCPToolRegistry(this.logger);
    this.rateLimiter = new RateLimiter({
      enabled: config.rateLimit.enabled,
      requestsPerMinute: config.rateLimit.requestsPerMinute,
    });

    // Initialize OpenTelemetry instrumentation
    if (config.otel?.enabled) {
      this.otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: config.otel.serviceName || "cam-mcp-gateway",
        serviceVersion: config.otel.serviceVersion || "2.1.0",
        exporterUrl: config.otel.exporterUrl,
      });
    } else {
      this.otel = createNoOpInstrumentation();
    }

    // Load policies
    for (const policy of config.policies) {
      this.policies.set(policy.id, policy);
    }
  }

  /**
   * Initialize the gateway with configured servers
   */
  async initialize(): Promise<void> {
    this.logger.info("Initializing MCP Gateway", {
      serverCount: this.config.servers.length,
      policyCount: this.policies.size,
    });

    // Connect to all configured servers
    for (const serverConfig of this.config.servers) {
      try {
        await this.registry.addServer(serverConfig);
      } catch (error) {
        this.logger.error(`Failed to add server: ${serverConfig.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const stats = this.registry.getStats();
    this.logger.info("MCP Gateway initialized", {
      connectedServers: stats.connectedServers,
      totalServers: stats.serverCount,
      tools: stats.toolCount,
      resources: stats.resourceCount,
    });
  }

  /**
   * Call a tool with policy enforcement and arbitration
   */
  async callTool(request: ToolCallRequest): Promise<ToolCallResult> {
    const traceId = randomUUID();
    const startTime = Date.now();
    const policyActions: PolicyAction[] = [];

    // Start OTel span for this tool call
    const span: Span = this.otel.startToolCallSpan(
      request.toolName,
      request.tenantId,
      request.userId,
    );

    this.logger.debug("Tool call request", {
      traceId,
      toolName: request.toolName,
    });

    // Rate limit check
    if (this.config.rateLimit.enabled) {
      const rateLimitResult = this.rateLimiter.checkLimit(request.tenantId);
      if (!rateLimitResult.allowed) {
        this.emitEvent({
          type: "rate_limited",
          tenantId: request.tenantId,
          limit: rateLimitResult.limit,
        });
        const result = this.createErrorResult(
          traceId,
          startTime,
          "Rate limit exceeded",
          policyActions,
        );
        this.otel.recordToolCallResult(span, result);
        return result;
      }
    }

    // Arbitrate: select the best tool
    const decision = await this.arbitrate(request, traceId);

    // Record audit
    const auditRecord: AuditRecord = {
      traceId,
      timestamp: new Date(),
      tenantId: request.tenantId,
      userId: request.userId,
      action: "tool_call",
      request: {
        toolName: request.toolName,
        arguments: this.config.audit.includeArguments
          ? request.arguments
          : undefined,
      },
      decision,
      policyActions,
    };

    if (!decision.allowed || !decision.selectedTool) {
      policyActions.push({
        policyId: "arbitration",
        action: "deny",
        reason: decision.reason,
        timestamp: new Date(),
      });
      auditRecord.policyActions = policyActions;
      this.recordAudit(auditRecord);

      this.emitEvent({
        type: "policy_violation",
        traceId,
        policyId: "arbitration",
        reason: decision.reason,
      });

      const result = this.createErrorResult(
        traceId,
        startTime,
        decision.reason,
        policyActions,
      );
      this.otel.recordToolCallResult(span, result);
      return result;
    }

    // Execute the tool call with retry logic
    const maxRetries = this.config.defaults.maxRetries ?? 0;
    const retryDelayMs = this.config.defaults.retryDelayMs ?? 500;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelayMs * attempt),
          );
          this.logger.debug(`Retrying tool call (attempt ${attempt + 1})`, {
            traceId,
            toolName: request.toolName,
          });
        }

        const client = this.registry.getClient(decision.selectedTool.serverId);
        if (!client) {
          throw new Error(
            `Server not connected: ${decision.selectedTool.serverId}`,
          );
        }

        const result = await client.callTool(
          decision.selectedTool.tool.name,
          request.arguments,
        );
        const latencyMs = Date.now() - startTime;

        // Update metrics
        this.registry.updateToolMetrics(decision.selectedTool.id, {
          latency: latencyMs,
          success: true,
        });

        const toolResult: ToolCallResult = {
          traceId,
          success: true,
          result: this.config.audit.includeResults ? result : undefined,
          serverId: decision.selectedTool.serverId,
          toolId: decision.selectedTool.id,
          latencyMs,
          cost: decision.estimatedCost || 0,
          policyActions,
          timestamp: new Date(),
        };

        auditRecord.result = toolResult;
        this.recordAudit(auditRecord);

        this.emitEvent({
          type: "tool_called",
          traceId,
          toolId: decision.selectedTool.id,
          success: true,
        });

        // Record successful result to OTel span
        this.otel.recordToolCallResult(span, toolResult);
        return toolResult;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Only retry on transient errors (timeouts, connection errors)
        const isTransient =
          lastError.message.includes("timed out") ||
          lastError.message.includes("ECONNREFUSED") ||
          lastError.message.includes("ETIMEDOUT") ||
          lastError.message.includes("connection error");

        if (!isTransient || attempt >= maxRetries) {
          break;
        }

        this.logger.warn(`Tool call failed (attempt ${attempt + 1}), retrying`, {
          traceId,
          error: lastError.message,
          attemptsLeft: maxRetries - attempt,
        });
      }
    }

    // All attempts failed
    const latencyMs = Date.now() - startTime;
    const errorMessage = lastError?.message || "Unknown error";

    // Update metrics
    if (decision.selectedTool) {
      this.registry.updateToolMetrics(decision.selectedTool.id, {
        latency: latencyMs,
        success: false,
        error: errorMessage,
      });
    }

    this.emitEvent({
      type: "tool_called",
      traceId,
      toolId: decision.selectedTool?.id || request.toolName,
      success: false,
    });

    const result = this.createErrorResult(
      traceId,
      startTime,
      errorMessage,
      policyActions,
      decision.selectedTool,
    );
    this.otel.recordToolCallResult(span, result);
    return result;
  }

  /**
   * Call a tool with streaming progress events
   * Returns an async generator that yields progress events during execution
   */
  async *callToolStreaming(
    request: ToolCallRequest,
  ): AsyncGenerator<ToolCallStreamEvent> {
    const traceId = randomUUID();
    const startTime = Date.now();
    const policyActions: PolicyAction[] = [];

    // Emit started event
    yield {
      type: "started",
      traceId,
      toolName: request.toolName,
      timestamp: new Date(),
    };

    // Rate limit check
    if (this.config.rateLimit.enabled) {
      const rateLimitResult = this.rateLimiter.checkLimit(request.tenantId);
      if (!rateLimitResult.allowed) {
        this.emitEvent({
          type: "rate_limited",
          tenantId: request.tenantId,
          limit: rateLimitResult.limit,
        });
        yield { type: "error", traceId, error: "Rate limit exceeded" };
        return;
      }
    }

    // Emit arbitrating event
    const findCriteria: Parameters<MCPToolRegistry["findTools"]>[0] = {
      name: request.toolName,
    };
    const candidates = this.registry.findTools(findCriteria);
    yield { type: "arbitrating", traceId, candidateCount: candidates.length };

    // Arbitrate
    const decision = await this.arbitrate(request, traceId);

    // Emit policy events
    for (const policyRef of decision.policyReferences) {
      yield {
        type: "policy_evaluated",
        traceId,
        policyId: policyRef,
        allowed: decision.allowed,
      };
    }

    if (!decision.allowed || !decision.selectedTool) {
      yield { type: "error", traceId, error: decision.reason };
      return;
    }

    // Emit tool selected event
    yield {
      type: "tool_selected",
      traceId,
      toolId: decision.selectedTool.id,
      serverId: decision.selectedTool.serverId,
    };

    // Emit executing event
    yield {
      type: "executing",
      traceId,
      toolId: decision.selectedTool.id,
    };

    // Execute the tool call
    try {
      const client = this.registry.getClient(decision.selectedTool.serverId);
      if (!client) {
        yield {
          type: "error",
          traceId,
          error: `Server not connected: ${decision.selectedTool.serverId}`,
        };
        return;
      }

      const result = await client.callTool(
        decision.selectedTool.tool.name,
        request.arguments,
      );
      const latencyMs = Date.now() - startTime;

      // Update metrics
      this.registry.updateToolMetrics(decision.selectedTool.id, {
        latency: latencyMs,
        success: true,
      });

      const toolResult: ToolCallResult = {
        traceId,
        success: true,
        result: this.config.audit.includeResults ? result : undefined,
        serverId: decision.selectedTool.serverId,
        toolId: decision.selectedTool.id,
        latencyMs,
        cost: decision.estimatedCost || 0,
        policyActions,
        timestamp: new Date(),
      };

      // Record audit
      const auditRecord: AuditRecord = {
        traceId,
        timestamp: new Date(),
        tenantId: request.tenantId,
        userId: request.userId,
        action: "tool_call",
        request: {
          toolName: request.toolName,
          arguments: this.config.audit.includeArguments
            ? request.arguments
            : undefined,
        },
        decision,
        policyActions,
        result: toolResult,
      };
      this.recordAudit(auditRecord);

      // Emit completed event
      yield { type: "completed", traceId, result: toolResult };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      yield { type: "error", traceId, error: errorMessage };
    }
  }

  /**
   * Arbitrate: select the best tool based on policies and requirements
   */
  private async arbitrate(
    request: ToolCallRequest,
    traceId: string,
  ): Promise<ArbitrationDecision> {
    // Find matching tools
    const findCriteria: Parameters<MCPToolRegistry["findTools"]>[0] = {
      name: request.toolName,
    };
    if (request.context?.maxCost !== undefined) {
      findCriteria.maxCost = request.context.maxCost;
    }
    if (request.context?.preferredServer !== undefined) {
      findCriteria.serverId = request.context.preferredServer;
    }
    const candidates = this.registry.findTools(findCriteria);

    if (candidates.length === 0) {
      return {
        allowed: false,
        reason: `No tool found matching: ${request.toolName}`,
        policyReferences: [],
        traceId,
      };
    }

    // Apply policies to filter candidates
    const allowedCandidates: RegisteredTool[] = [];
    const policyReferences: string[] = [];

    for (const tool of candidates) {
      const policyResult = this.evaluatePolicies(tool, request);
      policyReferences.push(...policyResult.references);

      if (policyResult.allowed) {
        allowedCandidates.push(tool);
      }
    }

    if (allowedCandidates.length === 0) {
      return {
        allowed: false,
        reason: "All matching tools blocked by policy",
        policyReferences,
        traceId,
      };
    }

    // Score and select best tool
    const scoredTools = allowedCandidates.map((tool) => ({
      tool,
      score: this.scoreTool(tool, request),
    }));

    scoredTools.sort((a, b) => b.score - a.score);
    const best = scoredTools[0];

    // TypeScript can't infer from earlier length check, but we know this is defined
    if (!best) {
      return {
        allowed: false,
        reason: "No tools available after scoring",
        policyReferences,
        traceId,
      };
    }

    const selectedTool = best.tool;

    return {
      allowed: true,
      selectedTool,
      reason: "Tool selected by arbitration",
      policyReferences,
      traceId,
      alternativeTools: scoredTools.slice(1, 4).map((s) => s.tool),
      estimatedCost: selectedTool.costEstimate,
      estimatedLatency: selectedTool.latencyP50,
    };
  }

  /**
   * Evaluate policies against a tool and request
   */
  private evaluatePolicies(
    tool: RegisteredTool,
    request: ToolCallRequest,
  ): { allowed: boolean; references: string[] } {
    const references: string[] = [];
    let allowed = true;

    // Sort policies by priority
    const sortedPolicies = Array.from(this.policies.values()).sort(
      (a, b) => b.priority - a.priority,
    );

    for (const policy of sortedPolicies) {
      if (!policy.enabled) continue;

      const matches = this.evaluateConditions(policy.conditions, tool, request);
      if (!matches) continue;

      references.push(policy.id);

      // Check actions
      if (policy.actions.includes("deny")) {
        allowed = false;
        this.logger.debug(`Policy ${policy.id} denied tool ${tool.id}`);
        break;
      }
    }

    return { allowed, references };
  }

  /**
   * Evaluate policy conditions
   */
  private evaluateConditions(
    conditions: MCPPolicy["conditions"],
    tool: RegisteredTool,
    request: ToolCallRequest,
  ): boolean {
    for (const condition of conditions) {
      const value = this.getConditionValue(condition.field, tool, request);
      const matches = this.evaluateCondition(
        condition.operator,
        value,
        condition.value,
      );
      if (!matches) return false;
    }
    return true;
  }

  /**
   * Get value for condition evaluation
   */
  private getConditionValue(
    field: string,
    tool: RegisteredTool,
    request: ToolCallRequest,
  ): unknown {
    switch (field) {
      case "tool.name":
        return tool.tool.name;
      case "tool.trustTier":
        return tool.trustTier;
      case "tool.dataClassifications":
        return tool.dataClassifications;
      case "tool.costEstimate":
        return tool.costEstimate;
      case "tool.tags":
        return tool.tags;
      case "request.tenantId":
        return request.tenantId;
      case "request.userId":
        return request.userId;
      default:
        return undefined;
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    operator: MCPPolicy["conditions"][0]["operator"],
    actual: unknown,
    expected: unknown,
  ): boolean {
    switch (operator) {
      case "eq":
        return actual === expected;
      case "neq":
        return actual !== expected;
      case "in":
        return Array.isArray(expected) && expected.includes(actual);
      case "notIn":
        return Array.isArray(expected) && !expected.includes(actual);
      case "gt":
        return (
          typeof actual === "number" &&
          typeof expected === "number" &&
          actual > expected
        );
      case "lt":
        return (
          typeof actual === "number" &&
          typeof expected === "number" &&
          actual < expected
        );
      case "contains":
        return Array.isArray(actual) && actual.includes(expected);
      case "matches":
        try {
          const pattern = String(expected);
          if (pattern.length > 200) return false;
          return (
            typeof actual === "string" &&
            new RegExp(pattern).test(actual.slice(0, 10000))
          );
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  /**
   * Score a tool for selection
   */
  private scoreTool(tool: RegisteredTool, request: ToolCallRequest): number {
    let score = 100;

    // Trust tier bonus
    const trustBonus: Record<string, number> = {
      privileged: 20,
      trusted: 15,
      standard: 10,
      untrusted: 0,
    };
    score += trustBonus[tool.trustTier] || 0;

    // Cost penalty (lower is better)
    if (tool.costEstimate > 0) {
      score -= Math.min(tool.costEstimate * 10, 30);
    }

    // Latency penalty (lower is better)
    if (tool.latencyP50) {
      score -= Math.min(tool.latencyP50 / 100, 20);
    }

    // Success rate bonus
    if (tool.successRate !== undefined) {
      score += tool.successRate * 20;
    }

    // Preferred server bonus
    if (request.context?.preferredServer === tool.serverId) {
      score += 25;
    }

    return score;
  }

  /**
   * Create error result
   */
  private createErrorResult(
    traceId: string,
    startTime: number,
    error: string,
    policyActions: PolicyAction[],
    tool?: RegisteredTool,
  ): ToolCallResult {
    return {
      traceId,
      success: false,
      error,
      serverId: tool?.serverId || "unknown",
      toolId: tool?.id || "unknown",
      latencyMs: Date.now() - startTime,
      cost: 0,
      policyActions,
      timestamp: new Date(),
    };
  }

  /**
   * Record audit entry
   */
  private recordAudit(record: AuditRecord): void {
    if (!this.config.audit.enabled) return;

    this.auditLog.push(record);

    // Export to OpenTelemetry as a span
    this.otel.recordAuditAsSpan(record);

    // Write to JSONL file if configured
    if (this.config.audit.outputPath) {
      this.writeAuditToFile(record);
    }

    // Log to stdout as JSON for observability
    this.logger.info("AUDIT", {
      traceId: record.traceId,
      tenantId: record.tenantId,
      action: record.action,
      toolName: record.request.toolName,
      allowed: record.decision.allowed,
      selectedTool: record.decision.selectedTool?.id,
      reason: record.decision.reason,
      latencyMs: record.result?.latencyMs,
    });

    // Trim old entries from memory
    const maxAge = this.config.audit.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;
    this.auditLog = this.auditLog.filter((r) => r.timestamp.getTime() > cutoff);
  }

  /**
   * Write audit record to JSONL file
   */
  private writeAuditToFile(record: AuditRecord): void {
    const outputPath = this.config.audit.outputPath;
    if (!outputPath) return;

    try {
      // Ensure directory exists
      const dir = dirname(outputPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Serialize with safe date handling
      const jsonLine = JSON.stringify({
        ...record,
        timestamp: record.timestamp.toISOString(),
        decision: {
          ...record.decision,
          selectedTool: record.decision.selectedTool
            ? {
                id: record.decision.selectedTool.id,
                serverId: record.decision.selectedTool.serverId,
                toolName: record.decision.selectedTool.tool.name,
                trustTier: record.decision.selectedTool.trustTier,
                costEstimate: record.decision.selectedTool.costEstimate,
              }
            : undefined,
        },
        result: record.result
          ? {
              ...record.result,
              timestamp: record.result.timestamp.toISOString(),
            }
          : undefined,
        policyActions: record.policyActions.map((a) => ({
          ...a,
          timestamp: a.timestamp.toISOString(),
        })),
      });

      appendFileSync(outputPath, jsonLine + "\n", "utf-8");
    } catch (error) {
      this.logger.error("Failed to write audit to file", {
        error: error instanceof Error ? error.message : String(error),
        path: outputPath,
      });
    }
  }

  /**
   * Get audit records
   */
  getAuditLog(filter?: {
    tenantId?: string;
    action?: AuditRecord["action"];
    startTime?: Date;
    endTime?: Date;
  }): AuditRecord[] {
    let records = [...this.auditLog];

    if (filter?.tenantId) {
      records = records.filter((r) => r.tenantId === filter.tenantId);
    }
    if (filter?.action) {
      records = records.filter((r) => r.action === filter.action);
    }
    if (filter?.startTime) {
      records = records.filter((r) => r.timestamp >= filter.startTime!);
    }
    if (filter?.endTime) {
      records = records.filter((r) => r.timestamp <= filter.endTime!);
    }

    return records;
  }

  /**
   * Add a policy
   */
  addPolicy(policy: MCPPolicy): void {
    this.policies.set(policy.id, policy);
    this.logger.info(`Added policy: ${policy.name}`, { policyId: policy.id });
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId: string): void {
    this.policies.delete(policyId);
    this.logger.info(`Removed policy: ${policyId}`);
  }

  /**
   * Get all policies
   */
  getPolicies(): MCPPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Add event handler
   */
  onEvent(handler: (event: MCPGatewayEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  /**
   * Emit event to all handlers
   */
  private emitEvent(event: MCPGatewayEvent): void {
    // Record event as OTel span
    this.otel.recordGatewayEvent(event);

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error("Event handler error", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Get gateway stats
   */
  getStats(): {
    registry: ReturnType<MCPToolRegistry["getStats"]>;
    policies: number;
    auditRecords: number;
    rateLimiter: ReturnType<RateLimiter["getStats"]>;
  } {
    return {
      registry: this.registry.getStats(),
      policies: this.policies.size,
      auditRecords: this.auditLog.length,
      rateLimiter: this.rateLimiter.getStats(),
    };
  }

  /**
   * Get tool registry (for direct access)
   */
  getRegistry(): MCPToolRegistry {
    return this.registry;
  }

  /**
   * Health check — returns current gateway status suitable for /health endpoints
   */
  getHealth(): {
    status: "healthy" | "degraded" | "unhealthy";
    version: string;
    uptime: number;
    servers: {
      total: number;
      connected: number;
      disconnected: number;
    };
    /** @deprecated Use `servers` instead */
    registry: {
      serverCount: number;
      connectedServers: number;
      toolCount: number;
      resourceCount: number;
      promptCount: number;
    };
    tools: number;
    policies: number;
    auditRecords: number;
    rateLimit: {
      enabled: boolean;
      requestsPerMinute: number;
    };
    serverDetails: Array<{
      id: string;
      name: string;
      status: string;
      toolCount: number;
    }>;
  } {
    const registryStats = this.registry.getStats();
    const serverStatuses = this.registry.getAllServerStatuses();

    let status: "healthy" | "degraded" | "unhealthy";
    if (registryStats.serverCount === 0) {
      status = "healthy"; // No servers configured — valid state
    } else if (registryStats.connectedServers === 0) {
      status = "unhealthy"; // Servers configured but none connected
    } else if (registryStats.connectedServers < registryStats.serverCount) {
      status = "degraded"; // Some servers disconnected
    } else {
      status = "healthy";
    }

    return {
      status,
      version: "2.1.2",
      uptime: process.uptime(),
      servers: {
        total: registryStats.serverCount,
        connected: registryStats.connectedServers,
        disconnected: registryStats.serverCount - registryStats.connectedServers,
      },
      // Backward-compatible alias — use `servers` for new code
      registry: registryStats,
      tools: registryStats.toolCount,
      policies: this.policies.size,
      auditRecords: this.auditLog.length,
      rateLimit: {
        enabled: this.config.rateLimit.enabled,
        requestsPerMinute: this.config.rateLimit.requestsPerMinute,
      },
      serverDetails: serverStatuses.map((s) => ({
        id: s.config.id,
        name: s.config.name,
        status: s.status,
        toolCount: s.toolCount,
      })),
    };
  }

  /**
   * Shutdown the gateway
   */
  async shutdown(): Promise<void> {
    await this.otel.shutdown();
    await this.registry.shutdown();
    this.rateLimiter.shutdown();
    this.logger.info("MCP Gateway shutdown complete");
  }

  /**
   * Get the OTel tracer for custom instrumentation
   */
  getTracer() {
    return this.otel.getTracer();
  }
}
