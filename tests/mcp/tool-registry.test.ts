import { describe, it, expect, beforeEach, vi } from "vitest";
import type { MCPServerConfig, RegisteredTool } from "../../src/mcp/types.js";

// Mock the MCP client module - factory function must be self-contained
vi.mock("../../src/mcp/client.js", () => {
  class MockMCPClient {
    config: any;
    connected = false;

    constructor(config: any) {
      this.config = config;
    }

    async connect() {
      this.connected = true;
    }

    async disconnect() {
      this.connected = false;
    }

    isConnected() {
      return this.connected;
    }

    getServerId() {
      return this.config.id;
    }

    getConnectionStatus() {
      return {
        config: this.config,
        status: this.connected ? "connected" : "disconnected",
        lastConnected: this.connected ? new Date() : undefined,
        toolCount: 2,
        resourceCount: 0,
        promptCount: 0,
      };
    }

    getRegisteredTools() {
      return [
        {
          id: `${this.config.id}:tool1`,
          serverId: this.config.id,
          tool: { name: "tool1", description: "Test tool 1" },
          trustTier: this.config.trustTier,
          dataClassifications: this.config.dataClassifications || [],
          costEstimate: this.config.costPerCall || 0,
          callCount: 0,
          tags: ["tool1"],
        },
        {
          id: `${this.config.id}:tool2`,
          serverId: this.config.id,
          tool: { name: "tool2", description: "Test tool 2" },
          trustTier: this.config.trustTier,
          dataClassifications: this.config.dataClassifications || [],
          costEstimate: this.config.costPerCall || 0,
          callCount: 0,
          tags: ["tool2"],
        },
      ];
    }

    getRegisteredResources() {
      return [];
    }

    getRegisteredPrompts() {
      return [];
    }
  }

  return { MCPClient: MockMCPClient };
});

// Import after mock
import { MCPToolRegistry } from "../../src/mcp/tool-registry.js";

describe("MCPToolRegistry", () => {
  let registry: MCPToolRegistry;

  const serverConfigA: MCPServerConfig = {
    id: "server-a",
    name: "Test Server A",
    transport: "stdio",
    command: "test-mcp-a",
    trustTier: "trusted",
    costPerCall: 0.001,
    dataClassifications: ["internal"],
    enabled: true,
  };

  const serverConfigB: MCPServerConfig = {
    id: "server-b",
    name: "Test Server B",
    transport: "stdio",
    command: "test-mcp-b",
    trustTier: "standard",
    costPerCall: 0.002,
    dataClassifications: ["public"],
    enabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new MCPToolRegistry();
  });

  describe("addServer", () => {
    it("should add and connect to a server", async () => {
      await registry.addServer(serverConfigA);

      const stats = registry.getStats();
      expect(stats.serverCount).toBe(1);
      expect(stats.connectedServers).toBe(1);
      expect(stats.toolCount).toBe(2);
    });

    it("should skip disabled servers", async () => {
      const disabledConfig = { ...serverConfigA, enabled: false };
      await registry.addServer(disabledConfig);

      const stats = registry.getStats();
      expect(stats.serverCount).toBe(0);
    });

    it("should not add duplicate servers", async () => {
      await registry.addServer(serverConfigA);
      await registry.addServer(serverConfigA);

      const stats = registry.getStats();
      expect(stats.serverCount).toBe(1);
    });

    it("should add multiple servers", async () => {
      await registry.addServer(serverConfigA);
      await registry.addServer(serverConfigB);

      const stats = registry.getStats();
      expect(stats.serverCount).toBe(2);
      expect(stats.toolCount).toBe(4); // 2 tools per server
    });
  });

  describe("removeServer", () => {
    it("should remove a server and its tools", async () => {
      await registry.addServer(serverConfigA);
      await registry.addServer(serverConfigB);

      await registry.removeServer("server-a");

      const stats = registry.getStats();
      expect(stats.serverCount).toBe(1);
      expect(stats.toolCount).toBe(2); // Only server-b tools remain
    });

    it("should handle removing non-existent server", async () => {
      await registry.removeServer("nonexistent");
      // Should not throw
      expect(registry.getStats().serverCount).toBe(0);
    });
  });

  describe("getTool", () => {
    beforeEach(async () => {
      await registry.addServer(serverConfigA);
    });

    it("should get tool by exact ID", () => {
      const tool = registry.getTool("server-a:tool1");
      expect(tool).toBeDefined();
      expect(tool?.id).toBe("server-a:tool1");
    });

    it("should get tool by name", () => {
      const tool = registry.getTool("tool1");
      expect(tool).toBeDefined();
      expect(tool?.tool.name).toBe("tool1");
    });

    it("should return undefined for non-existent tool", () => {
      const tool = registry.getTool("nonexistent");
      expect(tool).toBeUndefined();
    });
  });

  describe("findTools", () => {
    beforeEach(async () => {
      await registry.addServer(serverConfigA);
      await registry.addServer(serverConfigB);
    });

    it("should find tools by name", () => {
      const tools = registry.findTools({ name: "tool1" });
      expect(tools).toHaveLength(2); // Both servers have tool1
    });

    it("should find tools by server ID", () => {
      const tools = registry.findTools({ serverId: "server-a" });
      expect(tools).toHaveLength(2);
      expect(tools.every((t) => t.serverId === "server-a")).toBe(true);
    });

    it("should find tools by trust tier", () => {
      const tools = registry.findTools({ trustTier: "trusted" });
      expect(tools).toHaveLength(2); // Only server-a is trusted
      expect(tools.every((t) => t.trustTier === "trusted")).toBe(true);
    });

    it("should find tools by max cost", () => {
      const tools = registry.findTools({ maxCost: 0.0015 });
      expect(tools).toHaveLength(2); // Only server-a tools (cost 0.001)
      expect(tools.every((t) => t.costEstimate <= 0.0015)).toBe(true);
    });

    it("should combine multiple criteria", () => {
      const tools = registry.findTools({
        name: "tool1",
        trustTier: "trusted",
      });
      expect(tools).toHaveLength(1);
      expect(tools[0].serverId).toBe("server-a");
    });

    it("should return empty array when no match", () => {
      const tools = registry.findTools({ name: "nonexistent" });
      expect(tools).toHaveLength(0);
    });
  });

  describe("getAllTools", () => {
    it("should return all registered tools", async () => {
      await registry.addServer(serverConfigA);
      await registry.addServer(serverConfigB);

      const allTools = registry.getAllTools();
      expect(allTools).toHaveLength(4);
    });

    it("should return empty array when no servers", () => {
      const allTools = registry.getAllTools();
      expect(allTools).toHaveLength(0);
    });
  });

  describe("getServerStatus", () => {
    it("should return server connection status", async () => {
      await registry.addServer(serverConfigA);

      const status = registry.getServerStatus("server-a");
      expect(status).toBeDefined();
      expect(status?.status).toBe("connected");
      expect(status?.config.id).toBe("server-a");
    });

    it("should return undefined for non-existent server", () => {
      const status = registry.getServerStatus("nonexistent");
      expect(status).toBeUndefined();
    });
  });

  describe("getAllServerStatuses", () => {
    it("should return all server statuses", async () => {
      await registry.addServer(serverConfigA);
      await registry.addServer(serverConfigB);

      const statuses = registry.getAllServerStatuses();
      expect(statuses).toHaveLength(2);
    });
  });

  describe("getClient", () => {
    it("should return client for a server", async () => {
      await registry.addServer(serverConfigA);

      const client = registry.getClient("server-a");
      expect(client).toBeDefined();
    });

    it("should return undefined for non-existent server", () => {
      const client = registry.getClient("nonexistent");
      expect(client).toBeUndefined();
    });
  });

  describe("updateToolMetrics", () => {
    beforeEach(async () => {
      await registry.addServer(serverConfigA);
    });

    it("should update latency metrics", () => {
      registry.updateToolMetrics("server-a:tool1", { latency: 100 });

      const tool = registry.getTool("server-a:tool1");
      expect(tool?.latencyP50).toBe(100);
      expect(tool?.callCount).toBe(1);
    });

    it("should update success rate", () => {
      registry.updateToolMetrics("server-a:tool1", { success: true });
      registry.updateToolMetrics("server-a:tool1", { success: true });
      registry.updateToolMetrics("server-a:tool1", { success: false });

      const tool = registry.getTool("server-a:tool1");
      expect(tool?.successRate).toBeCloseTo(0.667, 1);
    });

    it("should track last used time", () => {
      const before = new Date();
      registry.updateToolMetrics("server-a:tool1", { latency: 100 });
      const after = new Date();

      const tool = registry.getTool("server-a:tool1");
      expect(tool?.lastUsed).toBeDefined();
      expect(tool?.lastUsed!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(tool?.lastUsed!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should ignore non-existent tools", () => {
      // Should not throw
      registry.updateToolMetrics("nonexistent", { latency: 100 });
    });
  });

  describe("getRegistry", () => {
    it("should return full registry state", async () => {
      await registry.addServer(serverConfigA);

      const state = registry.getRegistry();
      expect(state.tools.size).toBe(2);
      expect(state.resources.size).toBe(0);
      expect(state.prompts.size).toBe(0);
      expect(state.servers.size).toBe(1);
    });
  });

  describe("shutdown", () => {
    it("should disconnect all servers and clear state", async () => {
      await registry.addServer(serverConfigA);
      await registry.addServer(serverConfigB);

      await registry.shutdown();

      const stats = registry.getStats();
      expect(stats.serverCount).toBe(0);
      expect(stats.toolCount).toBe(0);
    });
  });
});
