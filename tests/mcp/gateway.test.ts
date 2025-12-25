import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  MCPGatewayConfig,
  MCPPolicy,
  RegisteredTool,
  MCPServerConfig,
} from "../../src/mcp/types.js";

// Mock the tool registry module - factory must be self-contained
vi.mock("../../src/mcp/tool-registry.js", () => {
  class MockMCPToolRegistry {
    servers = new Map();
    tools = new Map();
    mockFindToolsResult: any[] = [];
    mockClient: any = null;

    async addServer(config: any) {
      this.servers.set(config.id, config);
    }

    findTools(_criteria: any) {
      return this.mockFindToolsResult;
    }

    getClient(_serverId: string) {
      return this.mockClient;
    }

    updateToolMetrics(_toolId: string, _metrics: any) {
      // No-op for tests
    }

    getStats() {
      return {
        serverCount: this.servers.size,
        connectedServers: this.servers.size,
        toolCount: this.tools.size,
        resourceCount: 0,
        promptCount: 0,
      };
    }

    async shutdown() {
      this.servers.clear();
      this.tools.clear();
    }
  }

  return { MCPToolRegistry: MockMCPToolRegistry };
});

// Import after mock
import { MCPGateway } from "../../src/mcp/gateway.js";

describe("MCPGateway", () => {
  let gateway: MCPGateway;
  let mockRegistry: any;

  const defaultConfig: MCPGatewayConfig = {
    servers: [
      {
        id: "server-a",
        name: "Test Server A",
        transport: "stdio",
        command: "test-mcp",
        trustTier: "trusted",
        enabled: true,
      },
      {
        id: "server-b",
        name: "Test Server B",
        transport: "stdio",
        command: "test-mcp-b",
        trustTier: "standard",
        enabled: true,
      },
    ],
    policies: [],
    defaults: {
      timeout: 30000,
      maxRetries: 3,
      retryDelayMs: 1000,
      defaultTrustTier: "standard",
    },
    audit: {
      enabled: true,
      retentionDays: 30,
      includeArguments: true,
      includeResults: false,
    },
    rateLimit: {
      enabled: true,
      requestsPerMinute: 100,
    },
  };

  const createMockTool = (
    id: string,
    serverId: string,
    name: string,
    trustTier: "untrusted" | "standard" | "trusted" | "privileged" = "standard",
    costEstimate: number = 0.001
  ): RegisteredTool => ({
    id,
    serverId,
    tool: { name, description: `Test tool ${name}` },
    trustTier,
    dataClassifications: [],
    costEstimate,
    callCount: 0,
    tags: [name],
  });

  const createMockClient = () => ({
    callTool: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "result" }] }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new MCPGateway(defaultConfig);
    mockRegistry = (gateway as any).registry;
  });

  describe("initialization", () => {
    it("should initialize with configured servers", async () => {
      await gateway.initialize();

      expect(mockRegistry.servers.size).toBe(2);
      expect(mockRegistry.servers.has("server-a")).toBe(true);
      expect(mockRegistry.servers.has("server-b")).toBe(true);
    });

    it("should load policies from config", () => {
      const configWithPolicies: MCPGatewayConfig = {
        ...defaultConfig,
        policies: [
          {
            id: "test-policy",
            name: "Test Policy",
            description: "A test policy",
            priority: 100,
            enabled: true,
            conditions: [],
            actions: ["allow"],
          },
        ],
      };

      const gatewayWithPolicies = new MCPGateway(configWithPolicies);
      const policies = gatewayWithPolicies.getPolicies();

      expect(policies).toHaveLength(1);
      expect(policies[0].id).toBe("test-policy");
    });
  });

  describe("callTool - basic routing", () => {
    it("should route to the best matching tool", async () => {
      const mockTools = [
        createMockTool("server-a:search", "server-a", "search", "trusted", 0.001),
        createMockTool("server-b:search", "server-b", "search", "standard", 0.002),
      ];

      mockRegistry.mockFindToolsResult = mockTools;
      mockRegistry.mockClient = createMockClient();

      const result = await gateway.callTool({
        toolName: "search",
        arguments: { query: "test" },
        tenantId: "tenant-1",
      });

      expect(result.success).toBe(true);
      expect(result.serverId).toBe("server-a"); // Higher trust tier
      expect(result.traceId).toBeDefined();
    });

    it("should return error when no tool found", async () => {
      mockRegistry.mockFindToolsResult = [];

      const result = await gateway.callTool({
        toolName: "nonexistent",
        arguments: {},
        tenantId: "tenant-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("No tool found");
    });

    it("should honor preferred server when specified", async () => {
      const mockTools = [
        createMockTool("server-a:search", "server-a", "search", "trusted", 0.001),
        createMockTool("server-b:search", "server-b", "search", "standard", 0.002),
      ];

      mockRegistry.mockFindToolsResult = mockTools;
      mockRegistry.mockClient = createMockClient();

      const result = await gateway.callTool({
        toolName: "search",
        arguments: { query: "test" },
        tenantId: "tenant-1",
        context: { preferredServer: "server-b" },
      });

      expect(result.success).toBe(true);
      expect(result.serverId).toBe("server-b"); // Preferred server bonus overcomes trust tier
    });
  });

  describe("callTool - policy enforcement", () => {
    it("should deny requests blocked by policy", async () => {
      const configWithDenyPolicy: MCPGatewayConfig = {
        ...defaultConfig,
        policies: [
          {
            id: "deny-untrusted",
            name: "Deny Untrusted",
            description: "Block untrusted tools",
            priority: 100,
            enabled: true,
            conditions: [{ field: "tool.trustTier", operator: "eq", value: "untrusted" }],
            actions: ["deny"],
          },
        ],
      };

      const gatewayWithPolicy = new MCPGateway(configWithDenyPolicy);
      const policyRegistry = (gatewayWithPolicy as any).registry;

      const mockTools = [
        createMockTool("server-c:risky", "server-c", "risky", "untrusted", 0.001),
      ];

      policyRegistry.mockFindToolsResult = mockTools;

      const result = await gatewayWithPolicy.callTool({
        toolName: "risky",
        arguments: {},
        tenantId: "tenant-1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("blocked by policy");
    });

    it("should allow requests not matching deny conditions", async () => {
      const configWithDenyPolicy: MCPGatewayConfig = {
        ...defaultConfig,
        policies: [
          {
            id: "deny-untrusted",
            name: "Deny Untrusted",
            description: "Block untrusted tools",
            priority: 100,
            enabled: true,
            conditions: [{ field: "tool.trustTier", operator: "eq", value: "untrusted" }],
            actions: ["deny"],
          },
        ],
      };

      const gatewayWithPolicy = new MCPGateway(configWithDenyPolicy);
      const policyRegistry = (gatewayWithPolicy as any).registry;

      const mockTools = [
        createMockTool("server-a:safe", "server-a", "safe", "trusted", 0.001),
      ];

      policyRegistry.mockFindToolsResult = mockTools;
      policyRegistry.mockClient = createMockClient();

      const result = await gatewayWithPolicy.callTool({
        toolName: "safe",
        arguments: {},
        tenantId: "tenant-1",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("callTool - rate limiting", () => {
    it("should enforce rate limits", async () => {
      const configWithLowLimit: MCPGatewayConfig = {
        ...defaultConfig,
        rateLimit: {
          enabled: true,
          requestsPerMinute: 2,
        },
      };

      const gatewayWithLimit = new MCPGateway(configWithLowLimit);
      const limitRegistry = (gatewayWithLimit as any).registry;

      const mockTools = [
        createMockTool("server-a:search", "server-a", "search", "trusted"),
      ];

      limitRegistry.mockFindToolsResult = mockTools;
      limitRegistry.mockClient = createMockClient();

      // First two requests should succeed
      await gatewayWithLimit.callTool({
        toolName: "search",
        arguments: {},
        tenantId: "rate-test",
      });

      await gatewayWithLimit.callTool({
        toolName: "search",
        arguments: {},
        tenantId: "rate-test",
      });

      // Third request should be rate limited
      const result = await gatewayWithLimit.callTool({
        toolName: "search",
        arguments: {},
        tenantId: "rate-test",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Rate limit");
    });
  });

  describe("audit logging", () => {
    it("should record audit entries for tool calls", async () => {
      const mockTools = [
        createMockTool("server-a:search", "server-a", "search", "trusted"),
      ];

      mockRegistry.mockFindToolsResult = mockTools;
      mockRegistry.mockClient = createMockClient();

      await gateway.callTool({
        toolName: "search",
        arguments: { query: "test" },
        tenantId: "audit-test",
        userId: "user-1",
      });

      const auditLog = gateway.getAuditLog({ tenantId: "audit-test" });

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0].tenantId).toBe("audit-test");
      expect(auditLog[0].userId).toBe("user-1");
      expect(auditLog[0].action).toBe("tool_call");
    });

    it("should filter audit log by criteria", async () => {
      const mockTools = [
        createMockTool("server-a:search", "server-a", "search", "trusted"),
      ];

      mockRegistry.mockFindToolsResult = mockTools;
      mockRegistry.mockClient = createMockClient();

      // Make calls for different tenants
      await gateway.callTool({
        toolName: "search",
        arguments: {},
        tenantId: "tenant-a",
      });

      await gateway.callTool({
        toolName: "search",
        arguments: {},
        tenantId: "tenant-b",
      });

      const auditLogA = gateway.getAuditLog({ tenantId: "tenant-a" });
      const auditLogB = gateway.getAuditLog({ tenantId: "tenant-b" });

      expect(auditLogA).toHaveLength(1);
      expect(auditLogB).toHaveLength(1);
    });
  });

  describe("policy management", () => {
    it("should add policies dynamically", () => {
      const newPolicy: MCPPolicy = {
        id: "dynamic-policy",
        name: "Dynamic Policy",
        description: "Added at runtime",
        priority: 50,
        enabled: true,
        conditions: [],
        actions: ["log"],
      };

      gateway.addPolicy(newPolicy);
      const policies = gateway.getPolicies();

      expect(policies.find((p) => p.id === "dynamic-policy")).toBeDefined();
    });

    it("should remove policies", () => {
      const policy: MCPPolicy = {
        id: "removable",
        name: "Removable",
        description: "Will be removed",
        priority: 50,
        enabled: true,
        conditions: [],
        actions: ["log"],
      };

      gateway.addPolicy(policy);
      expect(gateway.getPolicies().find((p) => p.id === "removable")).toBeDefined();

      gateway.removePolicy("removable");
      expect(gateway.getPolicies().find((p) => p.id === "removable")).toBeUndefined();
    });
  });

  describe("event handling", () => {
    it("should emit events for tool calls", async () => {
      const events: any[] = [];
      gateway.onEvent((event) => events.push(event));

      const mockTools = [
        createMockTool("server-a:search", "server-a", "search", "trusted"),
      ];

      mockRegistry.mockFindToolsResult = mockTools;
      mockRegistry.mockClient = createMockClient();

      await gateway.callTool({
        toolName: "search",
        arguments: {},
        tenantId: "event-test",
      });

      expect(events.some((e) => e.type === "tool_called")).toBe(true);
    });

    it("should emit rate limit events", async () => {
      const configWithLowLimit: MCPGatewayConfig = {
        ...defaultConfig,
        rateLimit: {
          enabled: true,
          requestsPerMinute: 1,
        },
      };

      const gatewayWithLimit = new MCPGateway(configWithLowLimit);
      const events: any[] = [];
      gatewayWithLimit.onEvent((event) => events.push(event));

      const limitRegistry = (gatewayWithLimit as any).registry;
      const mockTools = [
        createMockTool("server-a:search", "server-a", "search", "trusted"),
      ];

      limitRegistry.mockFindToolsResult = mockTools;
      limitRegistry.mockClient = createMockClient();

      // First request succeeds
      await gatewayWithLimit.callTool({
        toolName: "search",
        arguments: {},
        tenantId: "rate-event-test",
      });

      // Second request triggers rate limit
      await gatewayWithLimit.callTool({
        toolName: "search",
        arguments: {},
        tenantId: "rate-event-test",
      });

      expect(events.some((e) => e.type === "rate_limited")).toBe(true);
    });
  });

  describe("stats", () => {
    it("should return gateway stats", () => {
      const stats = gateway.getStats();

      expect(stats.registry).toBeDefined();
      expect(stats.policies).toBe(0);
      expect(stats.auditRecords).toBe(0);
      expect(stats.rateLimiter).toBeDefined();
    });
  });

  describe("shutdown", () => {
    it("should shutdown cleanly", async () => {
      await gateway.shutdown();

      // Verify shutdown was called by checking the registry is cleared
      expect(mockRegistry.servers.size).toBe(0);
    });
  });
});
