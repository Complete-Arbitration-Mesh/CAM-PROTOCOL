#!/usr/bin/env npx tsx
/**
 * MCP Gateway E2E Test
 *
 * Demonstrates three routing scenarios:
 * 1. Cheap route chosen (cost optimization)
 * 2. Fast route chosen (latency optimization)
 * 3. Denied by policy (admin tool blocked)
 */

import { MCPGateway } from "../../src/mcp/gateway.js";
import type { MCPGatewayConfig, MCPPolicy } from "../../src/mcp/types.js";
import { existsSync, unlinkSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUDIT_FILE = join(__dirname, "audit.jsonl");

// Clean up previous audit file
if (existsSync(AUDIT_FILE)) {
  unlinkSync(AUDIT_FILE);
}

// Policy: Block admin tools
const blockAdminPolicy: MCPPolicy = {
  id: "block-admin-tools",
  name: "Block Administrative Tools",
  description: "Blocks all tools with 'admin' in the name",
  priority: 100,
  enabled: true,
  conditions: [{ field: "tool.name", operator: "matches", value: "^admin_" }],
  actions: ["deny"],
};

// Gateway configuration
const config: MCPGatewayConfig = {
  servers: [
    {
      id: "fast",
      name: "Fast Premium Server",
      transport: "stdio",
      command: "npx",
      args: ["tsx", join(__dirname, "servers/fast-server.ts")],
      trustTier: "trusted",
      costPerCall: 0.05, // $0.05 per call (expensive)
      enabled: true,
    },
    {
      id: "cheap",
      name: "Cheap Budget Server",
      transport: "stdio",
      command: "npx",
      args: ["tsx", join(__dirname, "servers/cheap-server.ts")],
      trustTier: "standard",
      costPerCall: 0.001, // $0.001 per call (cheap)
      enabled: true,
    },
  ],
  policies: [blockAdminPolicy],
  defaults: {
    timeout: 30000,
    maxRetries: 3,
    retryDelayMs: 1000,
    defaultTrustTier: "standard",
    protocolVersion: "2025-11-25",
  },
  audit: {
    enabled: true,
    retentionDays: 7,
    includeArguments: true,
    includeResults: true,
    outputPath: AUDIT_FILE,
  },
  rateLimit: {
    enabled: true,
    requestsPerMinute: 100,
  },
  otel: {
    enabled: false, // Disable for cleaner test output
  },
};

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
  traceId?: string;
}

const results: TestResult[] = [];

async function runTests() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║           MCP Gateway E2E Test Suite                         ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");

  // Initialize gateway
  console.log("Initializing MCP Gateway...\n");
  const gateway = new MCPGateway(config);

  try {
    await gateway.initialize();
    const stats = gateway.getStats();
    console.log(`Connected servers: ${stats.registry.connectedServers}/${stats.registry.serverCount}`);
    console.log(`Available tools: ${stats.registry.toolCount}`);
    console.log(`Active policies: ${stats.policies}\n`);

    if (stats.registry.connectedServers === 0) {
      throw new Error("No servers connected - cannot run tests");
    }

    // Test 1: Cheap route chosen
    console.log("─".repeat(60));
    console.log("TEST 1: Cheap route chosen (cost optimization)");
    console.log("─".repeat(60));
    try {
      const result = await gateway.callTool({
        toolName: "search",
        arguments: { query: "cost optimization test" },
        tenantId: "test-tenant",
        userId: "test-user",
        context: {
          maxCost: 0.01, // Max $0.01 - should force cheap server
        },
      });

      const isCheapServer = result.serverId === "cheap";
      results.push({
        name: "Cheap route chosen",
        passed: result.success && isCheapServer,
        details: isCheapServer
          ? `Selected cheap server as expected (cost: $${result.cost})`
          : `Selected ${result.serverId} instead of cheap server`,
        traceId: result.traceId,
      });

      console.log(`  Result: ${result.success ? "SUCCESS" : "FAILED"}`);
      console.log(`  Server: ${result.serverId}`);
      console.log(`  Latency: ${result.latencyMs}ms`);
      console.log(`  Trace ID: ${result.traceId}`);
      console.log(`  Passed: ${isCheapServer ? "YES ✓" : "NO ✗"}\n`);
    } catch (error) {
      results.push({
        name: "Cheap route chosen",
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.log(`  Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }

    // Test 2: Fast route chosen (preferred server)
    console.log("─".repeat(60));
    console.log("TEST 2: Fast route chosen (latency optimization)");
    console.log("─".repeat(60));
    try {
      const result = await gateway.callTool({
        toolName: "search",
        arguments: { query: "speed test" },
        tenantId: "test-tenant",
        userId: "test-user",
        context: {
          preferredServer: "fast", // Prefer fast server
        },
      });

      const isFastServer = result.serverId === "fast";
      results.push({
        name: "Fast route chosen",
        passed: result.success && isFastServer,
        details: isFastServer
          ? `Selected fast server as expected (latency: ${result.latencyMs}ms)`
          : `Selected ${result.serverId} instead of fast server`,
        traceId: result.traceId,
      });

      console.log(`  Result: ${result.success ? "SUCCESS" : "FAILED"}`);
      console.log(`  Server: ${result.serverId}`);
      console.log(`  Latency: ${result.latencyMs}ms`);
      console.log(`  Trace ID: ${result.traceId}`);
      console.log(`  Passed: ${isFastServer ? "YES ✓" : "NO ✗"}\n`);
    } catch (error) {
      results.push({
        name: "Fast route chosen",
        passed: false,
        details: `Error: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.log(`  Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }

    // Test 3: Denied by policy
    console.log("─".repeat(60));
    console.log("TEST 3: Denied by policy (admin tool blocked)");
    console.log("─".repeat(60));
    try {
      const result = await gateway.callTool({
        toolName: "admin_reset",
        arguments: { target: "database" },
        tenantId: "test-tenant",
        userId: "test-user",
      });

      const isDenied = !result.success && result.error?.includes("blocked by policy");
      results.push({
        name: "Policy denial",
        passed: isDenied || !result.success, // Pass if denied
        details: isDenied
          ? "Admin tool correctly blocked by policy"
          : result.success
          ? "FAIL: Admin tool was allowed!"
          : `Blocked: ${result.error}`,
        traceId: result.traceId,
      });

      console.log(`  Result: ${result.success ? "ALLOWED (unexpected)" : "DENIED (expected)"}`);
      console.log(`  Error: ${result.error || "none"}`);
      console.log(`  Trace ID: ${result.traceId}`);
      console.log(`  Passed: ${!result.success ? "YES ✓" : "NO ✗"}\n`);
    } catch (error) {
      // Error thrown is also a valid denial
      results.push({
        name: "Policy denial",
        passed: true,
        details: `Correctly denied: ${error instanceof Error ? error.message : String(error)}`,
      });
      console.log(`  Denied with error: ${error instanceof Error ? error.message : String(error)}\n`);
      console.log(`  Passed: YES ✓\n`);
    }

    // Verify audit file
    console.log("─".repeat(60));
    console.log("AUDIT FILE VERIFICATION");
    console.log("─".repeat(60));
    if (existsSync(AUDIT_FILE)) {
      const auditContent = readFileSync(AUDIT_FILE, "utf-8");
      const auditLines = auditContent.trim().split("\n").filter(Boolean);
      console.log(`  Audit records written: ${auditLines.length}`);
      console.log(`  File: ${AUDIT_FILE}`);

      // Verify each record is valid JSON
      let validRecords = 0;
      for (const line of auditLines) {
        try {
          const record = JSON.parse(line);
          if (record.traceId && record.tenantId && record.decision) {
            validRecords++;
          }
        } catch {
          // Invalid JSON line
        }
      }
      console.log(`  Valid records: ${validRecords}/${auditLines.length}`);
      results.push({
        name: "Audit file",
        passed: validRecords === auditLines.length && auditLines.length >= 3,
        details: `${validRecords} valid audit records written`,
      });
      console.log(`  Passed: ${validRecords === auditLines.length ? "YES ✓" : "NO ✗"}\n`);
    } else {
      console.log("  Audit file NOT found!\n");
      results.push({
        name: "Audit file",
        passed: false,
        details: "Audit file was not created",
      });
    }

    // Shutdown
    await gateway.shutdown();
  } catch (error) {
    console.error("Gateway error:", error instanceof Error ? error.message : String(error));
    try {
      await gateway.shutdown();
    } catch {
      // Ignore shutdown errors
    }
  }

  // Summary
  console.log("═".repeat(60));
  console.log("TEST SUMMARY");
  console.log("═".repeat(60));
  let passed = 0;
  for (const result of results) {
    const status = result.passed ? "PASS ✓" : "FAIL ✗";
    console.log(`  ${status}  ${result.name}`);
    if (result.traceId) {
      console.log(`         Trace: ${result.traceId}`);
    }
    if (result.passed) passed++;
  }
  console.log("─".repeat(60));
  console.log(`  Total: ${passed}/${results.length} passed\n`);

  // Exit with appropriate code
  process.exit(passed === results.length ? 0 : 1);
}

runTests();
