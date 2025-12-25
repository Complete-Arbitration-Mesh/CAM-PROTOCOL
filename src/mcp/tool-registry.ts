/**
 * MCP Tool Registry
 *
 * Aggregates tools, resources, and prompts from multiple MCP servers.
 * Provides unified discovery and lookup across the MCP ecosystem.
 */

import { Logger } from "../shared/logger.js";
import { MCPClient } from "./client.js";
import type {
  MCPServerConfig,
  MCPServerConnection,
  RegisteredTool,
  RegisteredResource,
  RegisteredPrompt,
  ToolRegistry,
  DataClassification,
} from "./types.js";

export class MCPToolRegistry {
  private clients: Map<string, MCPClient> = new Map();
  private tools: Map<string, RegisteredTool> = new Map();
  private resources: Map<string, RegisteredResource> = new Map();
  private prompts: Map<string, RegisteredPrompt> = new Map();
  private logger: Logger;
  private readonly MAX_LATENCY_SAMPLES = 100; // Keep last 100 latencies for percentile calc

  constructor(logger?: Logger) {
    this.logger = logger || new Logger("info");
  }

  /**
   * Calculate percentile from latency array
   */
  private calculatePercentile(latencies: number[], percentile: number): number {
    if (latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  /**
   * Add and connect to an MCP server
   */
  async addServer(config: MCPServerConfig): Promise<void> {
    if (!config.enabled) {
      this.logger.info(`Server ${config.name} is disabled, skipping`);
      return;
    }

    if (this.clients.has(config.id)) {
      this.logger.warn(`Server ${config.id} already registered`);
      return;
    }

    const client = new MCPClient(config, this.logger);
    this.clients.set(config.id, client);

    try {
      await client.connect();
      this.refreshServerTools(config.id);
      this.logger.info(`Added MCP server: ${config.name}`, {
        serverId: config.id,
        tools: client.getRegisteredTools().length,
      });
    } catch (error) {
      this.logger.error(`Failed to connect to server: ${config.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      // Keep client in registry even if disconnected for retry
    }
  }

  /**
   * Remove an MCP server
   */
  async removeServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) {
      return;
    }

    await client.disconnect();
    this.clients.delete(serverId);

    // Remove all tools/resources/prompts from this server
    for (const [id, tool] of this.tools) {
      if (tool.serverId === serverId) {
        this.tools.delete(id);
      }
    }
    for (const [id, resource] of this.resources) {
      if (resource.serverId === serverId) {
        this.resources.delete(id);
      }
    }
    for (const [id, prompt] of this.prompts) {
      if (prompt.serverId === serverId) {
        this.prompts.delete(id);
      }
    }

    this.logger.info(`Removed MCP server: ${serverId}`);
  }

  /**
   * Refresh tools from a specific server
   */
  private refreshServerTools(serverId: string): void {
    const client = this.clients.get(serverId);
    if (!client || !client.isConnected()) {
      return;
    }

    // Clear existing entries from this server
    for (const [id, tool] of this.tools) {
      if (tool.serverId === serverId) {
        this.tools.delete(id);
      }
    }
    for (const [id, resource] of this.resources) {
      if (resource.serverId === serverId) {
        this.resources.delete(id);
      }
    }
    for (const [id, prompt] of this.prompts) {
      if (prompt.serverId === serverId) {
        this.prompts.delete(id);
      }
    }

    // Add new entries
    for (const tool of client.getRegisteredTools()) {
      this.tools.set(tool.id, tool);
    }
    for (const resource of client.getRegisteredResources()) {
      this.resources.set(resource.id, resource);
    }
    for (const prompt of client.getRegisteredPrompts()) {
      this.prompts.set(prompt.id, prompt);
    }
  }

  /**
   * Refresh all servers
   */
  async refreshAll(): Promise<void> {
    for (const [serverId, client] of this.clients) {
      if (!client.isConnected()) {
        try {
          await client.connect();
        } catch (error) {
          this.logger.warn(`Failed to reconnect to ${serverId}`);
          continue;
        }
      }
      this.refreshServerTools(serverId);
    }
  }

  /**
   * Get a tool by ID or name
   */
  getTool(idOrName: string): RegisteredTool | undefined {
    // Try exact ID match first
    if (this.tools.has(idOrName)) {
      return this.tools.get(idOrName);
    }

    // Try name match (without server prefix)
    for (const tool of this.tools.values()) {
      if (tool.tool.name === idOrName) {
        return tool;
      }
    }

    return undefined;
  }

  /**
   * Find tools by criteria
   */
  findTools(criteria: {
    name?: string;
    tags?: string[];
    trustTier?: RegisteredTool["trustTier"];
    maxCost?: number;
    dataClassifications?: DataClassification[];
    serverId?: string;
  }): RegisteredTool[] {
    const results: RegisteredTool[] = [];

    for (const tool of this.tools.values()) {
      // Name filter (partial match)
      if (criteria.name && !tool.tool.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        continue;
      }

      // Server filter
      if (criteria.serverId && tool.serverId !== criteria.serverId) {
        continue;
      }

      // Trust tier filter
      if (criteria.trustTier && !this.trustTierMatches(tool.trustTier, criteria.trustTier)) {
        continue;
      }

      // Cost filter
      if (criteria.maxCost !== undefined && tool.costEstimate > criteria.maxCost) {
        continue;
      }

      // Tags filter (any match)
      if (criteria.tags && criteria.tags.length > 0) {
        const hasTag = criteria.tags.some((tag) =>
          tool.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase()))
        );
        if (!hasTag) continue;
      }

      // Data classification filter (must not have restricted data)
      if (criteria.dataClassifications && criteria.dataClassifications.length > 0) {
        const hasRestrictedData = tool.dataClassifications.some(
          (dc) => !criteria.dataClassifications!.includes(dc)
        );
        if (hasRestrictedData) continue;
      }

      results.push(tool);
    }

    return results;
  }

  /**
   * Check if trust tier meets minimum requirement
   */
  private trustTierMatches(
    actual: RegisteredTool["trustTier"],
    required: RegisteredTool["trustTier"]
  ): boolean {
    const tiers = ["untrusted", "standard", "trusted", "privileged"];
    return tiers.indexOf(actual) >= tiers.indexOf(required);
  }

  /**
   * Get all tools
   */
  getAllTools(): RegisteredTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get all resources
   */
  getAllResources(): RegisteredResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get all prompts
   */
  getAllPrompts(): RegisteredPrompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Get server connection status
   */
  getServerStatus(serverId: string): MCPServerConnection | undefined {
    const client = this.clients.get(serverId);
    return client?.getConnectionStatus();
  }

  /**
   * Get all server statuses
   */
  getAllServerStatuses(): MCPServerConnection[] {
    const statuses: MCPServerConnection[] = [];
    for (const client of this.clients.values()) {
      statuses.push(client.getConnectionStatus());
    }
    return statuses;
  }

  /**
   * Get client for a server (for direct tool calls)
   */
  getClient(serverId: string): MCPClient | undefined {
    return this.clients.get(serverId);
  }

  /**
   * Get registry stats
   */
  getStats(): {
    serverCount: number;
    connectedServers: number;
    toolCount: number;
    resourceCount: number;
    promptCount: number;
  } {
    let connectedServers = 0;
    for (const client of this.clients.values()) {
      if (client.isConnected()) connectedServers++;
    }

    return {
      serverCount: this.clients.size,
      connectedServers,
      toolCount: this.tools.size,
      resourceCount: this.resources.size,
      promptCount: this.prompts.size,
    };
  }

  /**
   * Get full registry state
   */
  getRegistry(): ToolRegistry {
    const servers = new Map<string, MCPServerConnection>();
    for (const client of this.clients.values()) {
      servers.set(client.getServerId(), client.getConnectionStatus());
    }

    return {
      tools: new Map(this.tools),
      resources: new Map(this.resources),
      prompts: new Map(this.prompts),
      servers,
    };
  }

  /**
   * Update tool metrics after a call
   */
  updateToolMetrics(
    toolId: string,
    metrics: {
      latency?: number;
      success?: boolean;
      error?: string;
    }
  ): void {
    const tool = this.tools.get(toolId);
    if (!tool) return;

    tool.callCount++;
    tool.lastUsed = new Date();

    if (metrics.latency !== undefined) {
      // Initialize latencies array if needed
      if (!tool.latencies) {
        tool.latencies = [];
      }

      // Add to rolling window
      tool.latencies.push(metrics.latency);
      if (tool.latencies.length > this.MAX_LATENCY_SAMPLES) {
        tool.latencies.shift();
      }

      // Calculate real percentiles from the samples
      tool.latencyP50 = this.calculatePercentile(tool.latencies, 50);
      tool.latencyP95 = this.calculatePercentile(tool.latencies, 95);
      tool.latencyP99 = this.calculatePercentile(tool.latencies, 99);
    }

    if (metrics.success !== undefined) {
      // Track success rate and error count
      if (!metrics.success) {
        tool.errorCount = (tool.errorCount || 0) + 1;
        if (metrics.error) {
          tool.lastError = metrics.error;
          tool.lastErrorTime = new Date();
        }
      }

      // Calculate success rate from counts
      tool.successRate = 1 - (tool.errorCount || 0) / tool.callCount;
    }
  }

  /**
   * Shutdown all connections
   */
  async shutdown(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
    this.tools.clear();
    this.resources.clear();
    this.prompts.clear();
    this.logger.info("MCP Tool Registry shutdown complete");
  }
}
