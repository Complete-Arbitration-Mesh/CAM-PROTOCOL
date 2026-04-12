/**
 * MCP Client
 *
 * Connects to MCP servers and manages tool/resource/prompt discovery.
 * Supports stdio, SSE, and HTTP transports.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import type {
  Tool,
  Resource,
  Prompt,
  CallToolResult,
  ReadResourceResult,
  GetPromptResult,
} from "@modelcontextprotocol/sdk/types.js";
import { Logger } from "../shared/logger.js";
import type {
  MCPServerConfig,
  MCPServerConnection,
  RegisteredTool,
  RegisteredResource,
  RegisteredPrompt,
  MCPProtocolVersion,
} from "./types.js";

/** Default MCP protocol version */
const DEFAULT_PROTOCOL_VERSION: MCPProtocolVersion = "2025-11-25";

export class MCPClient {
  private client: Client;
  private config: MCPServerConfig;
  private logger: Logger;
  private connected: boolean = false;
  private tools: Map<string, Tool> = new Map();
  private resources: Map<string, Resource> = new Map();
  private prompts: Map<string, Prompt> = new Map();

  constructor(config: MCPServerConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger || new Logger("info");
    this.client = new Client({
      name: "cam-gateway",
      version: "2.1.0",
    });
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    const protocolVersion =
      this.config.protocolVersion || DEFAULT_PROTOCOL_VERSION;
    this.logger.info(`Connecting to MCP server: ${this.config.name}`, {
      transport: this.config.transport,
      serverId: this.config.id,
      protocolVersion,
    });

    try {
      const transport = await this.createTransport();
      await this.client.connect(transport);
      this.connected = true;

      // Discover capabilities
      await this.discoverTools();
      await this.discoverResources();
      await this.discoverPrompts();

      this.logger.info(`Connected to MCP server: ${this.config.name}`, {
        tools: this.tools.size,
        resources: this.resources.size,
        prompts: this.prompts.size,
      });
    } catch (error) {
      this.connected = false;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to connect to MCP server: ${this.config.name}`,
        {
          error: errorMessage,
        },
      );
      throw error;
    }
  }

  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.client.close();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error disconnecting from MCP server: ${this.config.name}`,
        {
          error: errorMessage,
        },
      );
      // Still mark as disconnected — we cannot use the connection after a close error
    } finally {
      this.connected = false;
      this.tools.clear();
      this.resources.clear();
      this.prompts.clear();
    }

    this.logger.info(`Disconnected from MCP server: ${this.config.name}`);
  }

  /**
   * Create transport based on config
   */
  private async createTransport(): Promise<
    StdioClientTransport | SSEClientTransport
  > {
    switch (this.config.transport) {
      case "stdio": {
        if (!this.config.command) {
          throw new Error("stdio transport requires command");
        }
        const stdioParams: {
          command: string;
          args?: string[];
          env?: Record<string, string>;
        } = {
          command: this.config.command,
        };
        if (this.config.args) {
          stdioParams.args = this.config.args;
        }
        if (this.config.env) {
          stdioParams.env = this.config.env;
        }
        return new StdioClientTransport(stdioParams);
      }

      case "sse":
        if (!this.config.endpoint) {
          throw new Error("SSE transport requires endpoint");
        }
        return new SSEClientTransport(new URL(this.config.endpoint));

      case "http":
        // HTTP transport uses SSE for now (MCP uses SSE for streaming)
        if (!this.config.endpoint) {
          throw new Error("HTTP transport requires endpoint");
        }
        return new SSEClientTransport(new URL(this.config.endpoint));

      default:
        throw new Error(`Unsupported transport: ${this.config.transport}`);
    }
  }

  /**
   * Discover available tools
   */
  private async discoverTools(): Promise<void> {
    try {
      const result = await this.client.listTools();
      this.tools.clear();

      for (const tool of result.tools) {
        this.tools.set(tool.name, tool);
      }

      this.logger.debug(
        `Discovered ${this.tools.size} tools from ${this.config.name}`,
      );
    } catch (error) {
      this.logger.warn(`Failed to list tools from ${this.config.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Discover available resources
   */
  private async discoverResources(): Promise<void> {
    try {
      const result = await this.client.listResources();
      this.resources.clear();

      for (const resource of result.resources) {
        this.resources.set(resource.uri, resource);
      }

      this.logger.debug(
        `Discovered ${this.resources.size} resources from ${this.config.name}`,
      );
    } catch (error) {
      this.logger.warn(`Failed to list resources from ${this.config.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Discover available prompts
   */
  private async discoverPrompts(): Promise<void> {
    try {
      const result = await this.client.listPrompts();
      this.prompts.clear();

      for (const prompt of result.prompts) {
        this.prompts.set(prompt.name, prompt);
      }

      this.logger.debug(
        `Discovered ${this.prompts.size} prompts from ${this.config.name}`,
      );
    } catch (error) {
      this.logger.warn(`Failed to list prompts from ${this.config.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Call a tool with timeout handling
   */
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    if (!this.connected) {
      throw new Error(`Not connected to MCP server: ${this.config.name}`);
    }

    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    this.logger.debug(`Calling tool: ${name}`, { serverId: this.config.id });

    const timeout = this.config.timeout || 30000; // Default 30s timeout
    const startTime = Date.now();

    try {
      const result = await this.withTimeout(
        this.client.callTool({ name, arguments: args }),
        timeout,
        `Tool call '${name}' timed out after ${timeout}ms`,
      );
      const latency = Date.now() - startTime;

      this.logger.debug(`Tool call completed: ${name}`, { latency });
      // The SDK may return different result shapes - normalize to CallToolResult
      return result as CallToolResult;
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Classify error types for better handling
      const isTimeout = errorMessage.includes("timed out");
      const isConnectionError =
        errorMessage.includes("ECONNREFUSED") ||
        errorMessage.includes("ENOTFOUND") ||
        errorMessage.includes("ETIMEDOUT");

      this.logger.error(`Tool call failed: ${name}`, {
        error: errorMessage,
        latency,
        isTimeout,
        isConnectionError,
      });

      // Wrap with additional context
      if (isTimeout) {
        throw new Error(
          `MCP server '${this.config.name}' timeout: ${errorMessage}`,
        );
      }
      if (isConnectionError) {
        throw new Error(
          `MCP server '${this.config.name}' connection error: ${errorMessage}`,
        );
      }
      throw error;
    }
  }

  /**
   * Execute a promise with timeout
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(errorMessage));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<ReadResourceResult> {
    if (!this.connected) {
      throw new Error(`Not connected to MCP server: ${this.config.name}`);
    }

    this.logger.debug(`Reading resource: ${uri}`, { serverId: this.config.id });

    try {
      const result = await this.client.readResource({ uri });
      return result;
    } catch (error) {
      this.logger.error(`Resource read failed: ${uri}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get a prompt
   */
  async getPrompt(
    name: string,
    args?: Record<string, string>,
  ): Promise<GetPromptResult> {
    if (!this.connected) {
      throw new Error(`Not connected to MCP server: ${this.config.name}`);
    }

    this.logger.debug(`Getting prompt: ${name}`, { serverId: this.config.id });

    try {
      const result = await this.client.getPrompt({ name, arguments: args });
      return result;
    } catch (error) {
      this.logger.error(`Prompt get failed: ${name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get registered tools with metadata
   */
  getRegisteredTools(): RegisteredTool[] {
    const registered: RegisteredTool[] = [];

    for (const [name, tool] of this.tools) {
      registered.push({
        id: `${this.config.id}:${name}`,
        serverId: this.config.id,
        tool,
        trustTier: this.config.trustTier,
        dataClassifications: this.config.dataClassifications || [],
        costEstimate: this.config.costPerCall || 0,
        callCount: 0,
        tags: this.extractTags(tool),
      });
    }

    return registered;
  }

  /**
   * Get registered resources with metadata
   */
  getRegisteredResources(): RegisteredResource[] {
    const registered: RegisteredResource[] = [];

    for (const [uri, resource] of this.resources) {
      registered.push({
        id: `${this.config.id}:${uri}`,
        serverId: this.config.id,
        resource,
        dataClassifications: this.config.dataClassifications || [],
      });
    }

    return registered;
  }

  /**
   * Get registered prompts with metadata
   */
  getRegisteredPrompts(): RegisteredPrompt[] {
    const registered: RegisteredPrompt[] = [];

    for (const [name, prompt] of this.prompts) {
      registered.push({
        id: `${this.config.id}:${name}`,
        serverId: this.config.id,
        prompt,
      });
    }

    return registered;
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): MCPServerConnection {
    return {
      config: this.config,
      status: this.connected ? "connected" : "disconnected",
      lastConnected: this.connected ? new Date() : undefined,
      toolCount: this.tools.size,
      resourceCount: this.resources.size,
      promptCount: this.prompts.size,
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get server ID
   */
  getServerId(): string {
    return this.config.id;
  }

  /**
   * Extract tags from tool description
   */
  private extractTags(tool: Tool): string[] {
    const tags: string[] = [];

    // Extract tags from tool name (e.g., "file_read" -> ["file", "read"])
    const nameParts = tool.name.split(/[_-]/);
    tags.push(...nameParts);

    // Look for common patterns in description
    const description = tool.description?.toLowerCase() || "";
    if (description.includes("file")) tags.push("file");
    if (description.includes("database") || description.includes("sql"))
      tags.push("database");
    if (description.includes("api") || description.includes("http"))
      tags.push("api");
    if (description.includes("search")) tags.push("search");
    if (description.includes("code") || description.includes("execute"))
      tags.push("code");

    return [...new Set(tags)];
  }
}
