/**
 * OTel Instrumentation Tests
 *
 * Tests span attribute recording, event emission, shutdown, and no-op
 * instrumentation for all gateway event types.
 *
 * Strategy: inject mock spans directly into recording methods rather than
 * mocking the OTel SDK packages (ESM isolation issues in Vitest).
 * Construction with enabled=true is a smoke test against the real SDK.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  MCPOTelInstrumentation,
  createNoOpInstrumentation,
} from "../../src/mcp/otel-instrumentation.js";
import type { ToolCallResult, AuditRecord, MCPGatewayEvent } from "../../src/mcp/types.js";

function makeMockSpan() {
  return {
    setAttributes: vi.fn(),
    setStatus: vi.fn(),
    addEvent: vi.fn(),
    recordException: vi.fn(),
    end: vi.fn(),
  };
}

const makeToolResult = (overrides: Partial<ToolCallResult> = {}): ToolCallResult => ({
  traceId: "trace-123",
  success: true,
  serverId: "server-a",
  toolId: "server-a:echo",
  latencyMs: 42,
  cost: 0.001,
  policyActions: [],
  timestamp: new Date(),
  ...overrides,
});

const makeAuditRecord = (overrides: Partial<AuditRecord> = {}): AuditRecord => ({
  traceId: "trace-456",
  timestamp: new Date(),
  tenantId: "tenant-1",
  action: "tool_call",
  request: { toolName: "echo" },
  decision: {
    allowed: true,
    reason: "Tool selected by arbitration",
    policyReferences: ["policy-a"],
    traceId: "trace-456",
  },
  policyActions: [],
  ...overrides,
});

describe("MCPOTelInstrumentation construction", () => {
  it("should construct without error when disabled", () => {
    expect(() =>
      new MCPOTelInstrumentation({ enabled: false, serviceName: "cam", serviceVersion: "1.0" }),
    ).not.toThrow();
  });

  it("should construct without error when enabled", () => {
    expect(() =>
      new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" }),
    ).not.toThrow();
  });

  it("should return a tracer when disabled", () => {
    const otel = new MCPOTelInstrumentation({ enabled: false, serviceName: "cam", serviceVersion: "1.0" });
    expect(otel.getTracer()).toBeDefined();
  });

  it("should return a tracer when enabled", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(otel.getTracer()).toBeDefined();
  });
});

describe("MCPOTelInstrumentation startToolCallSpan", () => {
  it("should return a span object", () => {
    const otel = new MCPOTelInstrumentation({ enabled: false, serviceName: "cam", serviceVersion: "1.0" });
    expect(otel.startToolCallSpan("echo", "tenant-1")).toBeDefined();
  });

  it("should not throw when userId is provided", () => {
    const otel = new MCPOTelInstrumentation({ enabled: false, serviceName: "cam", serviceVersion: "1.0" });
    expect(() => otel.startToolCallSpan("echo", "tenant-1", "user-1")).not.toThrow();
  });
});

describe("MCPOTelInstrumentation recordToolCallResult", () => {
  let otel: MCPOTelInstrumentation;

  beforeEach(() => {
    otel = new MCPOTelInstrumentation({ enabled: false, serviceName: "cam", serviceVersion: "1.0" });
  });

  it("should set success attributes for successful result", () => {
    const span = makeMockSpan();
    otel.recordToolCallResult(span as any, makeToolResult({ success: true, latencyMs: 150, cost: 0.005 }));
    expect(span.setAttributes).toHaveBeenCalledWith(
      expect.objectContaining({
        "mcp.trace.id": "trace-123",
        "mcp.latency.ms": 150,
        "mcp.cost": 0.005,
        "mcp.success": true,
      }),
    );
    expect(span.end).toHaveBeenCalled();
  });

  it("should record exception for failed result", () => {
    const span = makeMockSpan();
    otel.recordToolCallResult(span as any, makeToolResult({ success: false, error: "Tool execution failed" }));
    expect(span.recordException).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Tool execution failed" }),
    );
    expect(span.end).toHaveBeenCalled();
  });

  it("should record policy actions as span events", () => {
    const span = makeMockSpan();
    otel.recordToolCallResult(span as any, makeToolResult({
      policyActions: [
        { policyId: "rate-limit-policy", action: "allow", reason: "ok", timestamp: new Date() },
      ],
    }));
    expect(span.addEvent).toHaveBeenCalledWith(
      "policy_action",
      expect.objectContaining({ "mcp.policy.id": "rate-limit-policy" }),
    );
  });

  it("should end span for both success and failure", () => {
    const s1 = makeMockSpan();
    const s2 = makeMockSpan();
    otel.recordToolCallResult(s1 as any, makeToolResult({ success: true }));
    otel.recordToolCallResult(s2 as any, makeToolResult({ success: false, error: "err" }));
    expect(s1.end).toHaveBeenCalled();
    expect(s2.end).toHaveBeenCalled();
  });
});

describe("MCPOTelInstrumentation recordAuditAsSpan", () => {
  it("should not throw when disabled", () => {
    const otel = new MCPOTelInstrumentation({ enabled: false, serviceName: "cam", serviceVersion: "1.0" });
    expect(() => otel.recordAuditAsSpan(makeAuditRecord())).not.toThrow();
  });

  it("should not throw when enabled", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(() => otel.recordAuditAsSpan(makeAuditRecord())).not.toThrow();
  });

  it("should not throw with userId", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(() => otel.recordAuditAsSpan(makeAuditRecord({ userId: "u42" }))).not.toThrow();
  });

  it("should not throw with selectedTool in decision", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    const record = makeAuditRecord({
      decision: {
        allowed: true,
        reason: "ok",
        policyReferences: [],
        traceId: "t",
        selectedTool: {
          id: "srv:echo",
          serverId: "srv",
          tool: { name: "echo" },
          trustTier: "trusted",
          dataClassifications: [],
          costEstimate: 0,
          callCount: 0,
          tags: [],
        },
      },
    });
    expect(() => otel.recordAuditAsSpan(record)).not.toThrow();
  });

  it("should not throw with failed result", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(() =>
      otel.recordAuditAsSpan(
        makeAuditRecord({ result: makeToolResult({ success: false, error: "failed", latencyMs: 100 }) }),
      ),
    ).not.toThrow();
  });

  it("should not throw with successful result", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(() =>
      otel.recordAuditAsSpan(
        makeAuditRecord({ result: makeToolResult({ success: true, latencyMs: 50 }) }),
      ),
    ).not.toThrow();
  });
});

describe("MCPOTelInstrumentation recordGatewayEvent", () => {
  it("should not throw when disabled", () => {
    const otel = new MCPOTelInstrumentation({ enabled: false, serviceName: "cam", serviceVersion: "1.0" });
    expect(() =>
      otel.recordGatewayEvent({ type: "tool_called", traceId: "t", toolId: "x", success: true }),
    ).not.toThrow();
  });

  it("should not throw for server_connected", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(() =>
      otel.recordGatewayEvent({ type: "server_connected", serverId: "s1", toolCount: 5 }),
    ).not.toThrow();
  });

  it("should not throw for server_disconnected", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(() =>
      otel.recordGatewayEvent({ type: "server_disconnected", serverId: "s1", reason: "lost" }),
    ).not.toThrow();
  });

  it("should not throw for server_error", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(() =>
      otel.recordGatewayEvent({ type: "server_error", serverId: "s1", error: "ECONNRESET" }),
    ).not.toThrow();
  });

  it("should not throw for tool_called success", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(() =>
      otel.recordGatewayEvent({ type: "tool_called", traceId: "t1", toolId: "s:echo", success: true }),
    ).not.toThrow();
  });

  it("should not throw for tool_called failure", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(() =>
      otel.recordGatewayEvent({ type: "tool_called", traceId: "t2", toolId: "s:broken", success: false }),
    ).not.toThrow();
  });

  it("should not throw for policy_violation", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(() =>
      otel.recordGatewayEvent({ type: "policy_violation", traceId: "t3", policyId: "deny-all", reason: "blocked" }),
    ).not.toThrow();
  });

  it("should not throw for rate_limited", () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    expect(() =>
      otel.recordGatewayEvent({ type: "rate_limited", tenantId: "heavy", limit: 100 }),
    ).not.toThrow();
  });
});

describe("MCPOTelInstrumentation shutdown", () => {
  it("should shutdown cleanly when disabled", async () => {
    const otel = new MCPOTelInstrumentation({ enabled: false, serviceName: "cam", serviceVersion: "1.0" });
    await expect(otel.shutdown()).resolves.toBeUndefined();
  });

  it("should shutdown cleanly when enabled", async () => {
    const otel = new MCPOTelInstrumentation({ enabled: true, serviceName: "cam", serviceVersion: "1.0" });
    await expect(otel.shutdown()).resolves.toBeUndefined();
  });
});

describe("createNoOpInstrumentation", () => {
  it("should return MCPOTelInstrumentation instance", () => {
    expect(createNoOpInstrumentation()).toBeInstanceOf(MCPOTelInstrumentation);
  });

  it("should not throw when recording audit records", () => {
    const noop = createNoOpInstrumentation();
    expect(() => noop.recordAuditAsSpan(makeAuditRecord())).not.toThrow();
  });

  it("should not throw when recording gateway events", () => {
    const noop = createNoOpInstrumentation();
    expect(() =>
      noop.recordGatewayEvent({ type: "tool_called", traceId: "t", toolId: "x", success: true }),
    ).not.toThrow();
  });

  it("should not throw on startToolCallSpan", () => {
    const noop = createNoOpInstrumentation();
    expect(() => noop.startToolCallSpan("tool", "tenant")).not.toThrow();
  });

  it("should shutdown cleanly", async () => {
    const noop = createNoOpInstrumentation();
    await expect(noop.shutdown()).resolves.toBeUndefined();
  });

  it("should return a tracer", () => {
    expect(createNoOpInstrumentation().getTracer()).toBeDefined();
  });
});
