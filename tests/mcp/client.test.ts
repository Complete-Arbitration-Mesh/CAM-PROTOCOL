/**
 * MCPClient Tests
 *
 * Tests transport creation, tool/resource/prompt discovery,
 * error classification, timeout handling, and connection state.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import type { MCPServerConfig } from "../../src/mcp/types.js";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);
const mockListTools = vi.fn().mockResolvedValue({ tools: [] });
const mockListResources = vi.fn().mockResolvedValue({ resources: [] });
const mockListPrompts = vi.fn().mockResolvedValue({ prompts: [] });
const mockCallTool = vi.fn().mockResolvedValue({
  content: [{ type: "text", text: "result" }],
});
const mockReadResource = vi.fn().mockResolvedValue({ contents: [] });
const mockGetPrompt = vi.fn().mockResolvedValue({ messages: [] });

vi.mock("@modelcontextprotocol/sdk/client/index.js", () => {
  // Must use a proper class so `new Client(...)` works
  class MockClient {
    connect = mockConnect;
    close = mockClose;
    listTools = mockListTools;
    listResources = mockListResources;
    listPrompts = mockListPrompts;
    callTool = mockCallTool;
    readResource = mockReadResource;
    getPrompt = mockGetPrompt;
  }
  return { Client: MockClient };
});

// Stdio and SSE transport mocks — must be proper classes for `new` to work
vi.mock("@modelcontextprotocol/sdk/client/stdio.js", () => {
  class StdioClientTransport {
    constructor(_opts: unknown) {}
  }
  return { StdioClientTransport };
});

vi.mock("@modelcontextprotocol/sdk/client/sse.js", () => {
  class SSEClientTransport {
    constructor(_url: unknown) {}
  }
  return { SSEClientTransport };
});

// Import after mocks
import { MCPClient } from "../../src/mcp/client.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeConfig = (overrides: Partial<MCPServerConfig> = {}): MCPServerConfig => ({
  id: "test-server",
  name: "Test Server",
  transport: "stdio",
  command: "test-cmd",
  args: ["--arg1"],
  trustTier: "trusted",
  enabled: true,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MCPClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListTools.mockResolvedValue({ tools: [] });
    mockListResources.mockResolvedValue({ resources: [] });
    mockListPrompts.mockResolvedValue({ prompts: [] });
    mockConnect.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
  });

  // ─── Construction & Initial State ─────────────────────────────────────────

  describe("construction", () => {
    it("should start disconnected", () => {
      const client = new MCPClient(makeConfig());
      expect(client.isConnected()).toBe(false);
    });

    it("should return correct server ID", () => {
      const client = new MCPClient(makeConfig({ id: "my-server" }));
      expect(client.getServerId()).toBe("my-server");
    });

    it("should show disconnected status before connect", () => {
      const client = new MCPClient(makeConfig());
      const status = client.getConnectionStatus();
      expect(status.status).toBe("disconnected");
      expect(status.toolCount).toBe(0);
      expect(status.resourceCount).toBe(0);
      expect(status.promptCount).toBe(0);
    });
  });

  // ─── Connect ──────────────────────────────────────────────────────────────

  describe("connect", () => {
    it("should connect successfully with stdio transport", async () => {
      const client = new MCPClient(makeConfig({ transport: "stdio", command: "test-cmd" }));
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it("should pass env to stdio transport when provided", async () => {
      const client = new MCPClient(
        makeConfig({ transport: "stdio", command: "test-cmd", env: { FOO: "bar" } }),
      );
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it("should connect with SSE transport", async () => {
      const client = new MCPClient(
        makeConfig({ transport: "sse", endpoint: "http://localhost:3000/sse" }),
      );
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it("should connect with http transport (uses SSE under the hood)", async () => {
      const client = new MCPClient(
        makeConfig({ transport: "http", endpoint: "http://localhost:3000/mcp" }),
      );
      await client.connect();
      expect(client.isConnected()).toBe(true);
    });

    it("should be idempotent — double connect does not reconnect", async () => {
      const client = new MCPClient(makeConfig());
      await client.connect();
      await client.connect(); // second call should be no-op
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it("should throw if stdio transport has no command", async () => {
      const client = new MCPClient(makeConfig({ transport: "stdio", command: undefined }));
      await expect(client.connect()).rejects.toThrow("stdio transport requires command");
    });

    it("should throw if SSE transport has no endpoint", async () => {
      const client = new MCPClient(makeConfig({ transport: "sse", endpoint: undefined }));
      await expect(client.connect()).rejects.toThrow("SSE transport requires endpoint");
    });

    it("should throw if HTTP transport has no endpoint", async () => {
      const client = new MCPClient(makeConfig({ transport: "http", endpoint: undefined }));
      await expect(client.connect()).rejects.toThrow("HTTP transport requires endpoint");
    });

    it("should throw for unsupported transport type", async () => {
      const client = new MCPClient(makeConfig({ transport: "websocket" as any }));
      await expect(client.connect()).rejects.toThrow("Unsupported transport");
    });

    it("should mark as disconnected if connect throws", async () => {
      mockConnect.mockRejectedValueOnce(new Error("connection refused"));
      const client = new MCPClient(makeConfig());
      await expect(client.connect()).rejects.toThrow("connection refused");
      expect(client.isConnected()).toBe(false);
    });
  });

  // ─── Disconnect ───────────────────────────────────────────────────────────

  describe("disconnect", () => {
    it("should disconnect after connecting", async () => {
      const client = new MCPClient(makeConfig());
      await client.connect();
      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it("should be idempotent — disconnect when already disconnected is safe", async () => {
      const client = new MCPClient(makeConfig());
      await client.disconnect(); // never connected
      expect(mockClose).not.toHaveBeenCalled();
    });

    it("should handle close errors gracefully without throwing", async () => {
      mockClose.mockRejectedValueOnce(new Error("close failed"));
      const client = new MCPClient(makeConfig());
      await client.connect();
      await expect(client.disconnect()).resolves.toBeUndefined();
      expect(client.isConnected()).toBe(false);
    });
  });

  // ─── Tool Discovery ───────────────────────────────────────────────────────

  describe("tool discovery", () => {
    it("should discover tools on connect", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [
          { name: "search", description: "Search the web" },
          { name: "file_read", description: "Read a file" },
        ],
      });

      const client = new MCPClient(makeConfig());
      await client.connect();

      const tools = client.getRegisteredTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].tool.name).toBe("search");
      expect(tools[1].tool.name).toBe("file_read");
    });

    it("should assign server ID and trust tier to registered tools", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "echo", description: "Echo input" }],
      });

      const client = new MCPClient(makeConfig({ id: "srv-1", trustTier: "privileged" }));
      await client.connect();

      const tools = client.getRegisteredTools();
      expect(tools[0].id).toBe("srv-1:echo");
      expect(tools[0].serverId).toBe("srv-1");
      expect(tools[0].trustTier).toBe("privileged");
    });

    it("should use costPerCall for costEstimate", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "expensive", description: "Expensive tool" }],
      });

      const client = new MCPClient(makeConfig({ costPerCall: 0.05 }));
      await client.connect();

      const tools = client.getRegisteredTools();
      expect(tools[0].costEstimate).toBe(0.05);
    });

    it("should extract tags from tool name parts", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "file_read", description: "Read a file" }],
      });

      const client = new MCPClient(makeConfig());
      await client.connect();

      const tools = client.getRegisteredTools();
      expect(tools[0].tags).toContain("file");
      expect(tools[0].tags).toContain("read");
    });

    it("should extract tags from tool description keywords", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "mytool", description: "This tool accesses a database via SQL" }],
      });

      const client = new MCPClient(makeConfig());
      await client.connect();

      const tools = client.getRegisteredTools();
      expect(tools[0].tags).toContain("database");
    });

    it("should handle listTools failure gracefully", async () => {
      mockListTools.mockRejectedValueOnce(new Error("tools not supported"));

      const client = new MCPClient(makeConfig());
      await expect(client.connect()).resolves.toBeUndefined();
      expect(client.getRegisteredTools()).toHaveLength(0);
    });

    it("should assign empty dataClassifications when not configured", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "tool1", description: "A tool" }],
      });

      const client = new MCPClient(makeConfig()); // no dataClassifications
      await client.connect();

      const tools = client.getRegisteredTools();
      expect(tools[0].dataClassifications).toEqual([]);
    });

    it("should inherit dataClassifications from server config", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "tool1", description: "A tool" }],
      });

      const client = new MCPClient(
        makeConfig({ dataClassifications: ["pii", "internal"] }),
      );
      await client.connect();

      const tools = client.getRegisteredTools();
      expect(tools[0].dataClassifications).toEqual(["pii", "internal"]);
    });
  });

  // ─── Resource Discovery ───────────────────────────────────────────────────

  describe("resource discovery", () => {
    it("should discover resources on connect", async () => {
      mockListResources.mockResolvedValueOnce({
        resources: [{ uri: "file:///data/config.json", name: "Config" }],
      });

      const client = new MCPClient(makeConfig({ id: "res-srv" }));
      await client.connect();

      const resources = client.getRegisteredResources();
      expect(resources).toHaveLength(1);
      expect(resources[0].id).toBe("res-srv:file:///data/config.json");
    });

    it("should handle listResources failure gracefully", async () => {
      mockListResources.mockRejectedValueOnce(new Error("resources not supported"));

      const client = new MCPClient(makeConfig());
      await expect(client.connect()).resolves.toBeUndefined();
      expect(client.getRegisteredResources()).toHaveLength(0);
    });
  });

  // ─── Prompt Discovery ─────────────────────────────────────────────────────

  describe("prompt discovery", () => {
    it("should discover prompts on connect", async () => {
      mockListPrompts.mockResolvedValueOnce({
        prompts: [{ name: "summarize", description: "Summarize text" }],
      });

      const client = new MCPClient(makeConfig({ id: "prompt-srv" }));
      await client.connect();

      const prompts = client.getRegisteredPrompts();
      expect(prompts).toHaveLength(1);
      expect(prompts[0].id).toBe("prompt-srv:summarize");
    });

    it("should handle listPrompts failure gracefully", async () => {
      mockListPrompts.mockRejectedValueOnce(new Error("prompts not supported"));

      const client = new MCPClient(makeConfig());
      await expect(client.connect()).resolves.toBeUndefined();
      expect(client.getRegisteredPrompts()).toHaveLength(0);
    });
  });

  // ─── callTool ─────────────────────────────────────────────────────────────

  describe("callTool", () => {
    it("should throw if not connected", async () => {
      const client = new MCPClient(makeConfig());
      await expect(client.callTool("search", {})).rejects.toThrow("Not connected");
    });

    it("should throw if tool not found", async () => {
      const client = new MCPClient(makeConfig());
      await client.connect();
      // No tools discovered (mockListTools returns [])
      await expect(client.callTool("nonexistent", {})).rejects.toThrow("Tool not found");
    });

    it("should call tool successfully", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "echo", description: "Echo" }],
      });
      mockCallTool.mockResolvedValueOnce({ content: [{ type: "text", text: "hello" }] });

      const client = new MCPClient(makeConfig());
      await client.connect();

      const result = await client.callTool("echo", { message: "hello" });
      expect(result).toBeDefined();
      expect(mockCallTool).toHaveBeenCalledWith({ name: "echo", arguments: { message: "hello" } });
    });

    it("should wrap timeout errors with server name context", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "slow", description: "Slow tool" }],
      });
      // Simulate timeout: never resolves within configured timeout
      mockCallTool.mockImplementationOnce(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error("timed out after 1ms")), 5)),
      );

      const client = new MCPClient(makeConfig({ name: "SlowServer", timeout: 1 }));
      await client.connect();

      const error = await client.callTool("slow", {}).catch((e) => e);
      expect(error.message).toContain("SlowServer");
      expect(error.message).toContain("timeout");
    });

    it("should wrap connection errors with server name context", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "remote", description: "Remote tool" }],
      });
      mockCallTool.mockRejectedValueOnce(new Error("ECONNREFUSED 127.0.0.1:9999"));

      const client = new MCPClient(makeConfig({ name: "RemoteServer" }));
      await client.connect();

      const error = await client.callTool("remote", {}).catch((e) => e);
      expect(error.message).toContain("RemoteServer");
      expect(error.message).toContain("connection error");
    });

    it("should re-throw non-classified errors unchanged", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "broken", description: "Broken tool" }],
      });
      mockCallTool.mockRejectedValueOnce(new Error("some internal error"));

      const client = new MCPClient(makeConfig());
      await client.connect();

      await expect(client.callTool("broken", {})).rejects.toThrow("some internal error");
    });
  });

  // ─── readResource ─────────────────────────────────────────────────────────

  describe("readResource", () => {
    it("should throw if not connected", async () => {
      const client = new MCPClient(makeConfig());
      await expect(client.readResource("file:///test")).rejects.toThrow("Not connected");
    });

    it("should read resource successfully", async () => {
      mockReadResource.mockResolvedValueOnce({ contents: [{ type: "text", text: "data" }] });

      const client = new MCPClient(makeConfig());
      await client.connect();

      const result = await client.readResource("file:///test");
      expect(result).toBeDefined();
      expect(mockReadResource).toHaveBeenCalledWith({ uri: "file:///test" });
    });

    it("should throw on readResource error", async () => {
      mockReadResource.mockRejectedValueOnce(new Error("resource not found"));

      const client = new MCPClient(makeConfig());
      await client.connect();

      await expect(client.readResource("file:///missing")).rejects.toThrow("resource not found");
    });
  });

  // ─── getPrompt ────────────────────────────────────────────────────────────

  describe("getPrompt", () => {
    it("should throw if not connected", async () => {
      const client = new MCPClient(makeConfig());
      await expect(client.getPrompt("summarize")).rejects.toThrow("Not connected");
    });

    it("should get prompt successfully", async () => {
      mockGetPrompt.mockResolvedValueOnce({ messages: [] });

      const client = new MCPClient(makeConfig());
      await client.connect();

      const result = await client.getPrompt("summarize", { text: "hello" });
      expect(result).toBeDefined();
      expect(mockGetPrompt).toHaveBeenCalledWith({ name: "summarize", arguments: { text: "hello" } });
    });

    it("should throw on getPrompt error", async () => {
      mockGetPrompt.mockRejectedValueOnce(new Error("prompt not found"));

      const client = new MCPClient(makeConfig());
      await client.connect();

      await expect(client.getPrompt("missing")).rejects.toThrow("prompt not found");
    });
  });

  // ─── Connection Status ─────────────────────────────────────────────────────

  describe("getConnectionStatus", () => {
    it("should reflect connected state after connect", async () => {
      mockListTools.mockResolvedValueOnce({
        tools: [{ name: "t1", description: "T1" }, { name: "t2", description: "T2" }],
      });

      const client = new MCPClient(makeConfig());
      await client.connect();

      const status = client.getConnectionStatus();
      expect(status.status).toBe("connected");
      expect(status.toolCount).toBe(2);
      expect(status.lastConnected).toBeDefined();
    });

    it("should reflect disconnected state after disconnect", async () => {
      const client = new MCPClient(makeConfig());
      await client.connect();
      await client.disconnect();

      const status = client.getConnectionStatus();
      expect(status.status).toBe("disconnected");
    });
  });
});
