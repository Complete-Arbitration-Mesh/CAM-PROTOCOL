/**
 * MCPGateway coverage tests
 *
 * Targets uncovered branches in gateway.ts:
 * - getHealth() — all three status paths
 * - callToolStreaming() — full flow including policy evaluated events
 * - retry logic — transient error retries
 * - refreshAll on registry
 * - event handler errors being swallowed safely
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type {
  MCPGatewayConfig,
  RegisteredTool,
} from "../../src/mcp/types.js";

// Mock the tool registry module
vi.mock("../../src/mcp/tool-registry.js", () => {
  class MockMCPToolRegistry {
    servers = new Map();
    tools = new Map();
    mockFindToolsResult: any[] = [];
    mockClient: any = null;
    refreshAllCalled = false;

    async addServer(config: any) {
      this.servers.set(config.id, config);
    }

    findTools(_criteria: any) {
      return this.mockFindToolsResult;
    }

    getClient(_serverId: string) {
      return this.mockClient;
    }

    updateToolMetrics(_toolId: string, _metrics: any) {}

    getStats() {
      const total = this.servers.size;
      // mockConnectedCount allows tests to control connected ratio
      const connected =
        (this as any).mockConnectedCount !== undefined
          ? (this as any).mockConnectedCount
          : total;
      return {
        serverCount: total,
        connectedServers: connected,
        toolCount: this.tools.size,
        resourceCount: 0,
        promptCount: 0,
      };
    }

    getAllServerStatuses() {
      return Array.from(this.servers.entries()).map(([id, config]: [string, any]) => ({
        config: { id, name: config.name || id, ...config },
        status: (this as any).mockConnectedCount !== undefined
          ? ((this as any).mockConnectedCount > 0 ? "connected" : "disconnected")
          : "connected",
        toolCount: 0,
        resourceCount: 0,
        promptCount: 0,
      }));
    }

    async refreshAll() {
      this.refreshAllCalled = true;
    }

    async shutdown() {
      this.servers.clear();
      this.tools.clear();
    }
  }

  return { MCPToolRegistry: MockMCPToolRegistry };
});

import { MCPGateway } from "../../src/mcp/gateway.js";

const makeConfig = (
  overrides: Partial<MCPGatewayConfig> = {},
): MCPGatewayConfig => ({
  servers: [
    {
      id: "server-a",
      name: "Test Server A",
      transport: "stdio",
      command: "test-mcp",
      trustTier: "trusted",
      enabled: true,
    },
  ],
  policies: [],
  defaults: {
    timeout: 30000,
    maxRetries: 2,
    retryDelayMs: 1, // 1ms so tests don't hang
    defaultTrustTier: "standard",
    protocolVersion: "2025-11-25",
  },
  audit: {
    enabled: true,
    retentionDays: 30,
    includeArguments: false,
    includeResults: false,
  },
  rateLimit: {
    enabled: false,
    requestsPerMinute: 1000,
  },
  otel: {
    enabled: false,
  },
  ...overrides,
});

const createMockTool = (
  id: string,
  serverId: string,
  name: string,
  trustTier: "untrusted" | "standard" | "trusted" | "privileged" = "standard",
): RegisteredTool => ({
  id,
  serverId,
  tool: { name, description: `Test tool ${name}` },
  trustTier,
  dataClassifications: [],
  costEstimate: 0.001,
  callCount: 0,
  tags: [name],
});

describe("MCPGateway - getHealth()", () => {
  it("should return healthy when no servers configured", () => {
    const gateway = new MCPGateway(makeConfig({ servers: [] }));
    const health = gateway.getHealth();
    expect(health.status).toBe("healthy");
    expect(health.registry.serverCount).toBe(0);
  });

  it("should return healthy when all servers are connected", async () => {
    const gateway = new MCPGateway(makeConfig());
    await gateway.initialize();
    const reg = (gateway as any).registry;
    reg.mockConnectedCount = 1;

    const health = gateway.getHealth();
    expect(health.status).toBe("healthy");
    expect(health.registry.connectedServers).toBe(1);
    expect(typeof health.uptime).toBe("number");
    await gateway.shutdown();
  });

  it("should return degraded when some servers are disconnected", async () => {
    const gateway = new MCPGateway(makeConfig());
    await gateway.initialize();
    const reg = (gateway as any).registry;
    // 1 total, 0 connected → ratio = 0/1 = 0 → unhealthy
    // For degraded we need ratio between 0 and 1 exclusively
    // Add a second server so total=2, connected=1
    reg.servers.set("server-b", { id: "server-b" });
    reg.mockConnectedCount = 1;

    const health = gateway.getHealth();
    expect(health.status).toBe("degraded");
    await gateway.shutdown();
  });

  it("should return unhealthy when no servers are connected", async () => {
    const gateway = new MCPGateway(makeConfig());
    await gateway.initialize();
    const reg = (gateway as any).registry;
    reg.mockConnectedCount = 0;

    const health = gateway.getHealth();
    expect(health.status).toBe("unhealthy");
    await gateway.shutdown();
  });

  it("should include policy and audit counts in health", async () => {
    const gatewayWithPolicy = new MCPGateway(
      makeConfig({
        policies: [
          {
            id: "p1",
            name: "P1",
            description: "",
            priority: 1,
            enabled: true,
            conditions: [],
            actions: ["log"],
          },
        ],
      }),
    );
    await gatewayWithPolicy.initialize();

    const health = gatewayWithPolicy.getHealth();
    expect(health.policies).toBe(1);
    expect(health.auditRecords).toBe(0);

    await gatewayWithPolicy.shutdown();
  });
});

describe("MCPGateway - callToolStreaming()", () => {
  let gateway: MCPGateway;
  let mockRegistry: any;

  beforeEach(() => {
    vi.clearAllMocks();
    gateway = new MCPGateway(makeConfig());
    mockRegistry = (gateway as any).registry;
  });

  afterEach(async () => {
    await gateway.shutdown();
  });

  it("should yield started event first", async () => {
    mockRegistry.mockFindToolsResult = [];

    const events = [];
    for await (const event of gateway.callToolStreaming({
      toolName: "missing",
      arguments: {},
      tenantId: "t1",
    })) {
      events.push(event);
    }

    expect(events[0]?.type).toBe("started");
    expect((events[0] as any).toolName).toBe("missing");
  });

  it("should yield error when no tool found", async () => {
    mockRegistry.mockFindToolsResult = [];

    const events = [];
    for await (const event of gateway.callToolStreaming({
      toolName: "ghost",
      arguments: {},
      tenantId: "t1",
    })) {
      events.push(event);
    }

    const lastEvent = events[events.length - 1];
    expect(lastEvent?.type).toBe("error");
  });

  it("should yield policy_evaluated events when policies match", async () => {
    const gatewayWithPolicy = new MCPGateway(
      makeConfig({
        policies: [
          {
            id: "block-all",
            name: "Block All",
            description: "",
            priority: 100,
            enabled: true,
            conditions: [
              {
                field: "tool.trustTier",
                operator: "eq",
                value: "untrusted",
              },
            ],
            actions: ["deny"],
          },
        ],
      }),
    );
    const reg = (gatewayWithPolicy as any).registry;
    reg.mockFindToolsResult = [
      createMockTool("s:tool", "s", "tool", "untrusted"),
    ];

    const events = [];
    for await (const event of gatewayWithPolicy.callToolStreaming({
      toolName: "tool",
      arguments: {},
      tenantId: "t1",
    })) {
      events.push(event);
    }

    expect(
      events.some((e) => e.type === "policy_evaluated"),
    ).toBe(true);

    await gatewayWithPolicy.shutdown();
  });

  it("should yield tool_selected and executing events on successful arbitration", async () => {
    const mockClient = {
      callTool: vi
        .fn()
        .mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
    };
    mockRegistry.mockFindToolsResult = [
      createMockTool("server-a:search", "server-a", "search", "trusted"),
    ];
    mockRegistry.mockClient = mockClient;

    const events = [];
    for await (const event of gateway.callToolStreaming({
      toolName: "search",
      arguments: {},
      tenantId: "t1",
    })) {
      events.push(event);
    }

    const types = events.map((e) => e.type);
    expect(types).toContain("arbitrating");
    expect(types).toContain("tool_selected");
    expect(types).toContain("executing");
    expect(types).toContain("completed");
  });

  it("should yield error event when server client not found", async () => {
    mockRegistry.mockFindToolsResult = [
      createMockTool("server-a:search", "server-a", "search", "trusted"),
    ];
    mockRegistry.mockClient = null; // No client available

    const events = [];
    for await (const event of gateway.callToolStreaming({
      toolName: "search",
      arguments: {},
      tenantId: "t1",
    })) {
      events.push(event);
    }

    const errorEvent = events.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect((errorEvent as any).error).toContain("Server not connected");
  });

  it("should yield error event when rate limited", async () => {
    const rateLimitedGateway = new MCPGateway(
      makeConfig({ rateLimit: { enabled: true, requestsPerMinute: 1 } }),
    );
    const reg = (rateLimitedGateway as any).registry;
    const mockTools = [
      createMockTool("server-a:t", "server-a", "t", "trusted"),
    ];
    reg.mockFindToolsResult = mockTools;
    reg.mockClient = {
      callTool: vi
        .fn()
        .mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
    };

    // Exhaust the 1 req/min limit
    for await (const _ of rateLimitedGateway.callToolStreaming({
      toolName: "t",
      arguments: {},
      tenantId: "rl-test",
    })) {
      // consume
    }

    // Second call should be rate limited
    const events2 = [];
    for await (const event of rateLimitedGateway.callToolStreaming({
      toolName: "t",
      arguments: {},
      tenantId: "rl-test",
    })) {
      events2.push(event);
    }

    const hasRateLimitError = events2.some(
      (e) => e.type === "error" && (e as any).error?.includes("Rate limit"),
    );
    expect(hasRateLimitError).toBe(true);

    await rateLimitedGateway.shutdown();
  });
});

describe("MCPGateway - retry logic", () => {
  it("should retry on transient connection errors", async () => {
    vi.clearAllMocks();
    const gateway = new MCPGateway(
      makeConfig({
        defaults: {
          timeout: 30000,
          maxRetries: 2,
          retryDelayMs: 1,
          defaultTrustTier: "standard",
          protocolVersion: "2025-11-25",
        },
      }),
    );
    const reg = (gateway as any).registry;

    const mockTool = createMockTool("server-a:tool", "server-a", "tool", "trusted");
    reg.mockFindToolsResult = [mockTool];

    let callCount = 0;
    reg.mockClient = {
      callTool: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error("ECONNREFUSED connection refused"));
        }
        return Promise.resolve({ content: [{ type: "text", text: "ok" }] });
      }),
    };

    const result = await gateway.callTool({
      toolName: "tool",
      arguments: {},
      tenantId: "retry-test",
    });

    expect(result.success).toBe(true);
    expect(callCount).toBe(3); // Failed twice, succeeded on third
    await gateway.shutdown();
  });

  it("should not retry on non-transient errors", async () => {
    vi.clearAllMocks();
    const gateway = new MCPGateway(makeConfig());
    const reg = (gateway as any).registry;

    const mockTool = createMockTool("server-a:tool", "server-a", "tool", "trusted");
    reg.mockFindToolsResult = [mockTool];

    let callCount = 0;
    reg.mockClient = {
      callTool: vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.reject(new Error("Invalid argument: missing required field"));
      }),
    };

    const result = await gateway.callTool({
      toolName: "tool",
      arguments: {},
      tenantId: "no-retry-test",
    });

    expect(result.success).toBe(false);
    expect(callCount).toBe(1); // Should not retry non-transient errors
    await gateway.shutdown();
  });

  it("should exhaust retries and return error when all transient attempts fail", async () => {
    vi.clearAllMocks();
    const gateway = new MCPGateway(
      makeConfig({
        defaults: {
          timeout: 30000,
          maxRetries: 1,
          retryDelayMs: 1,
          defaultTrustTier: "standard",
          protocolVersion: "2025-11-25",
        },
      }),
    );
    const reg = (gateway as any).registry;

    const mockTool = createMockTool("server-a:tool", "server-a", "tool", "trusted");
    reg.mockFindToolsResult = [mockTool];

    reg.mockClient = {
      callTool: vi
        .fn()
        .mockRejectedValue(new Error("ETIMEDOUT connection timed out")),
    };

    const result = await gateway.callTool({
      toolName: "tool",
      arguments: {},
      tenantId: "exhaust-test",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("ETIMEDOUT");
    await gateway.shutdown();
  });
});

describe("MCPGateway - event handler safety", () => {
  it("should not throw when an event handler throws", async () => {
    vi.clearAllMocks();
    const gateway = new MCPGateway(makeConfig());
    const reg = (gateway as any).registry;

    reg.mockFindToolsResult = [
      createMockTool("server-a:search", "server-a", "search", "trusted"),
    ];
    reg.mockClient = {
      callTool: vi
        .fn()
        .mockResolvedValue({ content: [{ type: "text", text: "ok" }] }),
    };

    // Register a faulty event handler
    gateway.onEvent(() => {
      throw new Error("handler explosion");
    });

    // Should not throw despite bad handler
    const result = await gateway.callTool({
      toolName: "search",
      arguments: {},
      tenantId: "safe-event-test",
    });

    expect(result.success).toBe(true);
    await gateway.shutdown();
  });
});

describe("MCPGateway - getTracer()", () => {
  it("should return a tracer instance", () => {
    const gateway = new MCPGateway(makeConfig());
    const tracer = gateway.getTracer();
    expect(tracer).toBeDefined();
  });
});
