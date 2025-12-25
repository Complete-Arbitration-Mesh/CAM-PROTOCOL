/**
 * MCP Gateway
 *
 * The policy + arbitration + routing brain that sits above MCP servers.
 * Provides governance, routing, auditing, and reliability for MCP deployments.
 */

import { randomUUID } from "crypto";
import { Logger } from "../shared/logger.js";
import { MCPToolRegistry } from "./tool-registry.js";
import { RateLimiter } from "../routing/rate-limiter.js";
import type {
  MCPGatewayConfig,
  MCPPolicy,
  ToolCallRequest,
  ArbitrationDecision,
  ToolCallResult,
  AuditRecord,
  PolicyAction,
  RegisteredTool,
  MCPGatewayEvent,
} from "./types.js";

export class MCPGateway {
  private registry: MCPToolRegistry;
  private rateLimiter: RateLimiter;
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

    this.logger.debug("Tool call request", { traceId, toolName: request.toolName });

    // Rate limit check
    if (this.config.rateLimit.enabled) {
      const rateLimitResult = this.rateLimiter.checkLimit(request.tenantId);
      if (!rateLimitResult.allowed) {
        this.emitEvent({ type: "rate_limited", tenantId: request.tenantId, limit: rateLimitResult.limit });
        return this.createErrorResult(traceId, startTime, "Rate limit exceeded", policyActions);
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
        arguments: this.config.audit.includeArguments ? request.arguments : undefined,
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

      return this.createErrorResult(traceId, startTime, decision.reason, policyActions);
    }

    // Execute the tool call
    try {
      const client = this.registry.getClient(decision.selectedTool.serverId);
      if (!client) {
        throw new Error(`Server not connected: ${decision.selectedTool.serverId}`);
      }

      const result = await client.callTool(decision.selectedTool.tool.name, request.arguments);
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

      return toolResult;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update metrics
      if (decision.selectedTool) {
        this.registry.updateToolMetrics(decision.selectedTool.id, {
          latency: latencyMs,
          success: false,
        });
      }

      this.emitEvent({
        type: "tool_called",
        traceId,
        toolId: decision.selectedTool?.id || request.toolName,
        success: false,
      });

      return this.createErrorResult(traceId, startTime, errorMessage, policyActions, decision.selectedTool);
    }
  }

  /**
   * Arbitrate: select the best tool based on policies and requirements
   */
  private async arbitrate(request: ToolCallRequest, traceId: string): Promise<ArbitrationDecision> {
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
    request: ToolCallRequest
  ): { allowed: boolean; references: string[] } {
    const references: string[] = [];
    let allowed = true;

    // Sort policies by priority
    const sortedPolicies = Array.from(this.policies.values()).sort(
      (a, b) => b.priority - a.priority
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
    request: ToolCallRequest
  ): boolean {
    for (const condition of conditions) {
      const value = this.getConditionValue(condition.field, tool, request);
      const matches = this.evaluateCondition(condition.operator, value, condition.value);
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
    request: ToolCallRequest
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
    expected: unknown
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
        return typeof actual === "number" && typeof expected === "number" && actual > expected;
      case "lt":
        return typeof actual === "number" && typeof expected === "number" && actual < expected;
      case "contains":
        return Array.isArray(actual) && actual.includes(expected);
      case "matches":
        return typeof actual === "string" && new RegExp(String(expected)).test(actual);
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
    tool?: RegisteredTool
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

    // Trim old entries
    const maxAge = this.config.audit.retentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - maxAge;
    this.auditLog = this.auditLog.filter((r) => r.timestamp.getTime() > cutoff);

    this.logger.debug("Audit recorded", { traceId: record.traceId });
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
   * Shutdown the gateway
   */
  async shutdown(): Promise<void> {
    await this.registry.shutdown();
    this.rateLimiter.shutdown();
    this.logger.info("MCP Gateway shutdown complete");
  }
}
