/**
 * CAM MCP Gateway Server
 *
 * A standalone server that exposes the MCP Gateway as an HTTP API.
 * Use this for production deployments or as a reference implementation.
 */

import { createServer, IncomingMessage, ServerResponse } from "http";
import { MCPGateway } from "../../src/mcp/gateway.js";
import type { MCPGatewayConfig, ToolCallRequest } from "../../src/mcp/types.js";

// Configuration from environment or defaults
const config: MCPGatewayConfig = {
  servers: [
    // Add your MCP servers here
    // Example: filesystem server
    // {
    //   id: "filesystem",
    //   name: "Filesystem Server",
    //   transport: "stdio",
    //   command: "npx",
    //   args: ["-y", "@modelcontextprotocol/server-filesystem", "/data"],
    //   trustTier: "trusted",
    //   enabled: true,
    // },
  ],
  policies: [
    {
      id: "block-untrusted-pii",
      name: "Block PII to Untrusted Tools",
      description: "Prevents PII data from being sent to untrusted tools",
      priority: 100,
      enabled: true,
      conditions: [
        { field: "tool.trustTier", operator: "eq", value: "untrusted" },
        { field: "tool.dataClassifications", operator: "contains", value: "pii" },
      ],
      actions: ["deny"],
    },
    {
      id: "log-all-calls",
      name: "Log All Tool Calls",
      description: "Logs all tool calls for audit purposes",
      priority: 1,
      enabled: true,
      conditions: [],
      actions: ["log"],
    },
  ],
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
    requestsPerMinuteByTenant: {
      "premium": 500,
      "enterprise": 1000,
    },
  },
  otel: {
    enabled: process.env["CAM_OTEL_ENABLED"] === "true",
    serviceName: process.env["CAM_OTEL_SERVICE_NAME"] || "cam-mcp-gateway",
    serviceVersion: "2.1.0",
    exporterUrl: process.env["CAM_OTEL_EXPORTER_URL"] || "http://localhost:4318/v1/traces",
  },
};

// Create gateway instance
const gateway = new MCPGateway(config);

// HTTP request handler
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID, X-User-ID");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    switch (url.pathname) {
      case "/health":
        handleHealth(res);
        break;

      case "/tools":
        handleListTools(res);
        break;

      case "/call":
        if (req.method !== "POST") {
          sendError(res, 405, "Method not allowed");
          return;
        }
        await handleCallTool(req, res);
        break;

      case "/audit":
        handleAuditLog(req, res);
        break;

      case "/stats":
        handleStats(res);
        break;

      case "/policies":
        handlePolicies(res);
        break;

      default:
        sendError(res, 404, "Not found");
    }
  } catch (error) {
    console.error("Request error:", error);
    sendError(res, 500, error instanceof Error ? error.message : "Internal error");
  }
}

function handleHealth(res: ServerResponse): void {
  const stats = gateway.getStats();
  const healthy = stats.registry.connectedServers > 0 || stats.registry.serverCount === 0;

  res.writeHead(healthy ? 200 : 503, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    status: healthy ? "healthy" : "unhealthy",
    timestamp: new Date().toISOString(),
    servers: {
      total: stats.registry.serverCount,
      connected: stats.registry.connectedServers,
    },
    tools: stats.registry.toolCount,
  }));
}

function handleListTools(res: ServerResponse): void {
  const registry = gateway.getRegistry();
  const tools = registry.getAllTools().map(tool => ({
    id: tool.id,
    name: tool.tool.name,
    description: tool.tool.description,
    serverId: tool.serverId,
    trustTier: tool.trustTier,
    costEstimate: tool.costEstimate,
    callCount: tool.callCount,
  }));

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ tools }));
}

async function handleCallTool(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  const request: ToolCallRequest = JSON.parse(body);

  // Extract tenant/user from headers if not in body
  if (!request.tenantId) {
    request.tenantId = req.headers["x-tenant-id"] as string || "default";
  }
  if (!request.userId) {
    request.userId = req.headers["x-user-id"] as string;
  }

  const result = await gateway.callTool(request);

  res.writeHead(result.success ? 200 : 400, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));
}

function handleAuditLog(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const tenantId = url.searchParams.get("tenantId") || undefined;
  const limit = parseInt(url.searchParams.get("limit") || "100", 10);

  const records = gateway.getAuditLog({ tenantId }).slice(0, limit);

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ records, count: records.length }));
}

function handleStats(res: ServerResponse): void {
  const stats = gateway.getStats();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(stats));
}

function handlePolicies(res: ServerResponse): void {
  const policies = gateway.getPolicies();

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ policies }));
}

function sendError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: message }));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

// Start server
async function main(): Promise<void> {
  const port = parseInt(process.env["PORT"] || "8080", 10);

  console.log("Initializing MCP Gateway...");
  await gateway.initialize();

  const server = createServer(handleRequest);

  server.listen(port, () => {
    console.log(`CAM MCP Gateway running on http://localhost:${port}`);
    console.log("Endpoints:");
    console.log("  GET  /health   - Health check");
    console.log("  GET  /tools    - List available tools");
    console.log("  POST /call     - Call a tool");
    console.log("  GET  /audit    - Get audit log");
    console.log("  GET  /stats    - Gateway statistics");
    console.log("  GET  /policies - List policies");
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    server.close();
    await gateway.shutdown();
    process.exit(0);
  });
}

main().catch(err => {
  console.error("Failed to start gateway:", err);
  process.exit(1);
});
