#!/usr/bin/env npx tsx
/**
 * SSE MCP Server (Toy)
 *
 * A toy MCP server that exposes tools via Server-Sent Events transport.
 * Used for demonstrating CAM gateway with mixed transport types.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createServer, IncomingMessage, ServerResponse } from "http";

const PORT = parseInt(process.env.SSE_PORT || "3001", 10);

const server = new Server(
  {
    name: "sse-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Simulated latency (medium = 100-200ms)
const LATENCY_MIN = 100;
const LATENCY_MAX = 200;

function simulateLatency(): Promise<void> {
  const delay = LATENCY_MIN + Math.random() * (LATENCY_MAX - LATENCY_MIN);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search",
        description: "Search for information (SSE transport, medium tier)",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "weather",
        description: "Get weather information for a location",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "The location to get weather for",
            },
          },
          required: ["location"],
        },
      },
      {
        name: "pii_lookup",
        description: "Look up PII data (restricted, requires privileged tier)",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User ID to look up",
            },
          },
          required: ["user_id"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  await simulateLatency();

  switch (name) {
    case "search": {
      const query = (args as { query: string }).query;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              server: "sse-server",
              transport: "sse",
              query,
              results: [
                { title: "SSE Result 1", relevance: 0.82 },
                { title: "SSE Result 2", relevance: 0.75 },
              ],
              tier: "standard",
            }),
          },
        ],
      };
    }

    case "weather": {
      const location = (args as { location: string }).location;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              server: "sse-server",
              location,
              temperature: Math.round(15 + Math.random() * 20),
              unit: "celsius",
              conditions: ["sunny", "cloudy", "rainy"][Math.floor(Math.random() * 3)],
            }),
          },
        ],
      };
    }

    case "pii_lookup": {
      const userId = (args as { user_id: string }).user_id;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              server: "sse-server",
              user_id: userId,
              name: "John Doe",
              email: "john.doe@example.com",
              classification: "pii",
            }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Create HTTP server for SSE transport
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "healthy", server: "sse-server" }));
    return;
  }

  // SSE endpoint
  if (req.url === "/sse" || req.url === "/") {
    const transport = new SSEServerTransport("/message", res);
    await server.connect(transport);
    return;
  }

  // Message endpoint for SSE
  if (req.url === "/message" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      // The transport handles this internally
      res.writeHead(200);
      res.end();
    });
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

httpServer.listen(PORT, () => {
  console.error(`SSE MCP Server running on http://localhost:${PORT}`);
  console.error(`  SSE endpoint: http://localhost:${PORT}/sse`);
  console.error(`  Health check: http://localhost:${PORT}/health`);
});
