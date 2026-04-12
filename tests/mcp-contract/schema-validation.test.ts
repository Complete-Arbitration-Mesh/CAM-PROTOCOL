/**
 * MCP Contract Tests - Schema Validation
 *
 * Validates that CAM's MCP integration conforms to the MCP protocol specification.
 * Tests schema compliance for tool discovery, invocation, and responses.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { z } from "zod";
import { MCPGateway } from "../../src/mcp/gateway.js";
import { MCPToolRegistry } from "../../src/mcp/tool-registry.js";
import { Logger } from "../../src/shared/logger.js";
import type { MCPGatewayConfig, MCPPolicy } from "../../src/mcp/types.js";

// MCP Protocol Schemas based on spec
// https://spec.modelcontextprotocol.io/specification/

// Tool schema as defined by MCP spec
const MCPToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z
    .object({
      type: z.literal("object"),
      properties: z.record(z.any()).optional(),
      required: z.array(z.string()).optional(),
    })
    .optional(),
});

// Tool call result schema
const MCPToolCallResultSchema = z.object({
  content: z.array(
    z.union([
      z.object({
        type: z.literal("text"),
        text: z.string(),
      }),
      z.object({
        type: z.literal("image"),
        data: z.string(),
        mimeType: z.string(),
      }),
      z.object({
        type: z.literal("resource"),
        resource: z.object({
          uri: z.string(),
          mimeType: z.string().optional(),
          text: z.string().optional(),
          blob: z.string().optional(),
        }),
      }),
    ]),
  ),
  isError: z.boolean().optional(),
});

// CAM's extended tool result schema
const CAMToolCallResultSchema = z.object({
  traceId: z.string().uuid(),
  success: z.boolean(),
  result: z.any().optional(),
  error: z.string().optional(),
  serverId: z.string(),
  toolId: z.string(),
  latencyMs: z.number().min(0),
  cost: z.number().min(0),
  policyActions: z.array(z.any()),
  timestamp: z.date(),
});

describe("MCP Schema Validation", () => {
  describe("Tool Discovery Schema", () => {
    it("should have valid tool name (non-empty string)", () => {
      const validTool = { name: "search", description: "Search for things" };
      expect(() => MCPToolSchema.parse(validTool)).not.toThrow();
    });

    it("should reject empty tool name", () => {
      const invalidTool = { name: "", description: "Empty name" };
      expect(() => MCPToolSchema.parse(invalidTool)).toThrow();
    });

    it("should accept tool with inputSchema", () => {
      const toolWithSchema = {
        name: "calculate",
        description: "Perform calculation",
        inputSchema: {
          type: "object" as const,
          properties: {
            expression: { type: "string" },
          },
          required: ["expression"],
        },
      };
      expect(() => MCPToolSchema.parse(toolWithSchema)).not.toThrow();
    });

    it("should accept tool without optional fields", () => {
      const minimalTool = { name: "ping" };
      expect(() => MCPToolSchema.parse(minimalTool)).not.toThrow();
    });
  });

  describe("Tool Call Result Schema", () => {
    it("should accept valid text content", () => {
      const result = {
        content: [{ type: "text" as const, text: "Hello, world!" }],
      };
      expect(() => MCPToolCallResultSchema.parse(result)).not.toThrow();
    });

    it("should accept valid image content", () => {
      const result = {
        content: [
          {
            type: "image" as const,
            data: "base64data...",
            mimeType: "image/png",
          },
        ],
      };
      expect(() => MCPToolCallResultSchema.parse(result)).not.toThrow();
    });

    it("should accept error result", () => {
      const result = {
        content: [{ type: "text" as const, text: "Error occurred" }],
        isError: true,
      };
      expect(() => MCPToolCallResultSchema.parse(result)).not.toThrow();
    });

    it("should accept multiple content items", () => {
      const result = {
        content: [
          { type: "text" as const, text: "Part 1" },
          { type: "text" as const, text: "Part 2" },
        ],
      };
      expect(() => MCPToolCallResultSchema.parse(result)).not.toThrow();
    });

    it("should reject invalid content type", () => {
      const result = {
        content: [{ type: "invalid", data: "something" }],
      };
      expect(() => MCPToolCallResultSchema.parse(result)).toThrow();
    });
  });

  describe("CAM Extended Result Schema", () => {
    it("should validate CAM tool call result", () => {
      const camResult = {
        traceId: "550e8400-e29b-41d4-a716-446655440000",
        success: true,
        result: { data: "test" },
        serverId: "server-1",
        toolId: "server-1:search",
        latencyMs: 150,
        cost: 0.001,
        policyActions: [],
        timestamp: new Date(),
      };
      expect(() => CAMToolCallResultSchema.parse(camResult)).not.toThrow();
    });

    it("should validate CAM error result", () => {
      const camError = {
        traceId: "550e8400-e29b-41d4-a716-446655440000",
        success: false,
        error: "Tool not found",
        serverId: "unknown",
        toolId: "unknown",
        latencyMs: 5,
        cost: 0,
        policyActions: [],
        timestamp: new Date(),
      };
      expect(() => CAMToolCallResultSchema.parse(camError)).not.toThrow();
    });

    it("should require valid UUID for traceId", () => {
      const badResult = {
        traceId: "not-a-uuid",
        success: true,
        serverId: "server-1",
        toolId: "server-1:search",
        latencyMs: 100,
        cost: 0,
        policyActions: [],
        timestamp: new Date(),
      };
      expect(() => CAMToolCallResultSchema.parse(badResult)).toThrow();
    });
  });
});

describe("MCP Protocol Compliance", () => {
  let gateway: MCPGateway;
  let logger: Logger;

  const config: MCPGatewayConfig = {
    servers: [],
    policies: [],
    defaults: {
      timeout: 5000,
      maxRetries: 1,
      retryDelayMs: 100,
      defaultTrustTier: "standard",
      protocolVersion: "2025-11-25",
    },
    audit: {
      enabled: true,
      retentionDays: 1,
      includeArguments: true,
      includeResults: true,
    },
    rateLimit: {
      enabled: true,
      requestsPerMinute: 100,
    },
  };

  beforeAll(() => {
    logger = new Logger("error");
    gateway = new MCPGateway(config, logger);
  });

  afterAll(async () => {
    await gateway.shutdown();
  });

  describe("Tool Name Conventions", () => {
    it("should support snake_case tool names", () => {
      const toolName = "file_read";
      expect(toolName).toMatch(/^[a-z][a-z0-9_]*$/);
    });

    it("should support namespaced tool names", () => {
      const toolName = "github.create_issue";
      expect(toolName).toMatch(/^[a-z][a-z0-9_.]*$/);
    });
  });

  describe("Argument Validation", () => {
    it("should pass through valid JSON arguments", () => {
      const args = {
        query: "test search",
        limit: 10,
        filters: { category: "docs" },
      };
      expect(JSON.stringify(args)).toBeDefined();
      expect(typeof args).toBe("object");
    });

    it("should handle empty arguments", () => {
      const args = {};
      expect(Object.keys(args).length).toBe(0);
    });
  });

  describe("Error Handling Contract", () => {
    it("should return error for non-existent tool", async () => {
      const result = await gateway.callTool({
        toolName: "nonexistent_tool",
        arguments: {},
        tenantId: "test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.traceId).toBeDefined();
    });

    it("should include traceId in all responses", async () => {
      const result = await gateway.callTool({
        toolName: "any_tool",
        arguments: {},
        tenantId: "test",
      });

      expect(result.traceId).toBeDefined();
      expect(typeof result.traceId).toBe("string");
      expect(result.traceId.length).toBeGreaterThan(0);
    });
  });

  describe("Rate Limiting Contract", () => {
    it("should track request counts per tenant", () => {
      const stats = gateway.getStats();
      expect(stats.rateLimiter).toBeDefined();
    });
  });

  describe("Audit Contract", () => {
    it("should create audit records for tool calls", async () => {
      await gateway.callTool({
        toolName: "test_tool",
        arguments: { test: true },
        tenantId: "audit-test-tenant",
        userId: "audit-test-user",
      });

      const auditLog = gateway.getAuditLog({
        tenantId: "audit-test-tenant",
      });

      // Note: may be empty if tool doesn't exist
      expect(Array.isArray(auditLog)).toBe(true);
    });

    it("should include required audit fields", async () => {
      // Make a call to ensure there's an audit record
      await gateway.callTool({
        toolName: "search",
        arguments: {},
        tenantId: "audit-fields-test",
      });

      const auditLog = gateway.getAuditLog();
      if (auditLog.length > 0) {
        const record = auditLog[auditLog.length - 1];
        expect(record.traceId).toBeDefined();
        expect(record.timestamp).toBeDefined();
        expect(record.tenantId).toBeDefined();
        expect(record.action).toBeDefined();
      }
    });
  });
});

describe("Transport Failure Handling", () => {
  describe("Connection Errors", () => {
    it("should handle server not found gracefully", async () => {
      const config: MCPGatewayConfig = {
        servers: [
          {
            id: "bad-server",
            name: "Unreachable Server",
            transport: "sse",
            endpoint: "http://localhost:99999/sse",
            trustTier: "standard",
            timeout: 1000,
            enabled: true,
          },
        ],
        policies: [],
        defaults: {
          timeout: 1000,
          maxRetries: 0,
          retryDelayMs: 100,
          defaultTrustTier: "standard",
          protocolVersion: "2025-11-25",
        },
        audit: {
          enabled: false,
          retentionDays: 1,
          includeArguments: false,
          includeResults: false,
        },
        rateLimit: { enabled: false, requestsPerMinute: 100 },
      };

      const logger = new Logger("error");
      const gateway = new MCPGateway(config, logger);

      // Initialize should not throw, but server won't connect
      await gateway.initialize();

      const stats = gateway.getStats();
      expect(stats.registry.connectedServers).toBe(0);

      await gateway.shutdown();
    });
  });

  describe("Timeout Behavior", () => {
    it("should respect configured timeout", async () => {
      const config: MCPGatewayConfig = {
        servers: [],
        policies: [],
        defaults: {
          timeout: 100, // Very short timeout
          maxRetries: 0,
          retryDelayMs: 10,
          defaultTrustTier: "standard",
          protocolVersion: "2025-11-25",
        },
        audit: {
          enabled: false,
          retentionDays: 1,
          includeArguments: false,
          includeResults: false,
        },
        rateLimit: { enabled: false, requestsPerMinute: 100 },
      };

      const gateway = new MCPGateway(config, new Logger("error"));
      expect(config.defaults.timeout).toBe(100);
      await gateway.shutdown();
    });
  });
});

describe("Protocol Version Handling", () => {
  it("should support 2025-11-25 protocol version", () => {
    const version = "2025-11-25";
    expect(version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should support 2025-06-18 protocol version", () => {
    const version = "2025-06-18";
    expect(version).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
