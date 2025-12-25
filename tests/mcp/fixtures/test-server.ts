/**
 * Test MCP Server
 *
 * A minimal MCP server for integration testing.
 * Provides simple tools for testing the CAM MCP Gateway.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// Create server
const server = new Server(
  {
    name: "test-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools
const TOOLS = [
  {
    name: "echo",
    description: "Echoes the input back",
    inputSchema: {
      type: "object" as const,
      properties: {
        message: { type: "string", description: "Message to echo" },
      },
      required: ["message"],
    },
  },
  {
    name: "add",
    description: "Adds two numbers",
    inputSchema: {
      type: "object" as const,
      properties: {
        a: { type: "number", description: "First number" },
        b: { type: "number", description: "Second number" },
      },
      required: ["a", "b"],
    },
  },
  {
    name: "greet",
    description: "Returns a greeting",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Name to greet" },
      },
      required: ["name"],
    },
  },
  {
    name: "slow_tool",
    description: "Simulates a slow operation (for testing timeouts)",
    inputSchema: {
      type: "object" as const,
      properties: {
        delay_ms: { type: "number", description: "Delay in milliseconds" },
      },
      required: ["delay_ms"],
    },
  },
  {
    name: "error_tool",
    description: "Always throws an error (for testing error handling)",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
];

// Register tool listing handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "echo":
      return {
        content: [
          { type: "text", text: (args as { message: string }).message },
        ],
      };

    case "add": {
      const { a, b } = args as { a: number; b: number };
      return {
        content: [{ type: "text", text: String(a + b) }],
      };
    }

    case "greet": {
      const { name: greetName } = args as { name: string };
      return {
        content: [{ type: "text", text: `Hello, ${greetName}!` }],
      };
    }

    case "slow_tool": {
      const { delay_ms } = args as { delay_ms: number };
      await new Promise((resolve) => setTimeout(resolve, delay_ms));
      return {
        content: [{ type: "text", text: `Completed after ${delay_ms}ms` }],
      };
    }

    case "error_tool":
      throw new Error("This tool always fails");

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Test MCP Server started");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
