#!/usr/bin/env npx tsx
/**
 * Cheap MCP Server (Toy)
 *
 * A toy MCP server that simulates slow but inexpensive operations.
 * Used for demonstrating CAM gateway routing by cost preference.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "cheap-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Simulated latency (slow = 200-500ms)
const LATENCY_MIN = 200;
const LATENCY_MAX = 500;

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
        description: "Search for information (slow, budget tier)",
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
        description: "Perform calculations (slow, budget tier)",
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
        name: "weather",
        description: "Get weather information (cheap-only tool)",
        inputSchema: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "Location to get weather for",
            },
          },
          required: ["location"],
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
              server: "cheap-server",
              query,
              results: [
                { title: "Budget Result 1", relevance: 0.82 },
                { title: "Budget Result 2", relevance: 0.75 },
              ],
              latency: "slow",
              tier: "budget",
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
              server: "cheap-server",
              expression,
              result,
              tier: "budget",
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
              server: "cheap-server",
              location,
              weather: {
                temp: 72,
                conditions: "Sunny",
                humidity: 45,
              },
              tier: "budget",
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
  console.error("Cheap MCP Server running on stdio");
}

main().catch(console.error);
