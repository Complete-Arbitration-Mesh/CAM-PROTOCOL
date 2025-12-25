#!/usr/bin/env npx tsx
/**
 * Fast MCP Server (Toy)
 *
 * A toy MCP server that simulates fast but expensive operations.
 * Used for demonstrating CAM gateway routing by latency preference.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "fast-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Simulated latency (fast = 10-50ms)
const LATENCY_MIN = 10;
const LATENCY_MAX = 50;

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
        description: "Search for information (fast, premium tier)",
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
        name: "calculate",
        description: "Perform calculations (fast, premium tier)",
        inputSchema: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "Mathematical expression to evaluate",
            },
          },
          required: ["expression"],
        },
      },
      {
        name: "admin_reset",
        description: "Administrative reset operation (restricted)",
        inputSchema: {
          type: "object",
          properties: {
            target: {
              type: "string",
              description: "Target to reset",
            },
          },
          required: ["target"],
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
              server: "fast-server",
              query,
              results: [
                { title: "Fast Result 1", relevance: 0.95 },
                { title: "Fast Result 2", relevance: 0.88 },
              ],
              latency: "fast",
              tier: "premium",
            }),
          },
        ],
      };
    }

    case "calculate": {
      const expression = (args as { expression: string }).expression;
      // Simple eval for demo (DO NOT use in production!)
      let result: number;
      try {
        // Only allow safe numeric operations
        if (!/^[\d\s+\-*/().]+$/.test(expression)) {
          throw new Error("Invalid expression");
        }
        result = Function(`"use strict"; return (${expression})`)();
      } catch {
        result = NaN;
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              server: "fast-server",
              expression,
              result,
              tier: "premium",
            }),
          },
        ],
      };
    }

    case "admin_reset": {
      const target = (args as { target: string }).target;
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              server: "fast-server",
              action: "admin_reset",
              target,
              status: "completed",
            }),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Fast MCP Server running on stdio");
}

main().catch(console.error);
