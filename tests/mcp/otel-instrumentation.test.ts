/**
 * OTel Instrumentation Tests
 *
 * Tests span creation, attribute recording, event emission,
 * shutdown, and no-op instrumentation for all gateway event types.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mocks ────────────────────────────────────────────────────────────────────
// vi.mock factories are hoisted before variable declarations, so we must use
// vi.hoisted() to ensure mock functions exist when the factories run.

const {
  mockSpanSetAttributes,
  mockSpanSetStatus,
  mockSpanAddEvent,
  mockSpanRecordException,
  mockSpanEnd,
  mockStartSpan,
  mockGetTracer,
  mockProviderRegister,
  mockProviderShutdown,
} = vi.hoisted(() => {
  const mockSpanSetAttributes = vi.fn();
  const mockSpanSetStatus = vi.fn();
  const mockSpanAddEvent = vi.fn();
  const mockSpanRecordException = vi.fn();
  const mockSpanEnd = vi.fn();

  const createMockSpan = () => ({
    setAttributes: mockSpanSetAttributes,
    setStatus: mockSpanSetStatus,
    addEvent: mockSpanAddEvent,
    recordException: mockSpanRecordException,
    end: mockSpanEnd,
  });

  const mockStartSpan = vi.fn(() => createMockSpan());
  const mockGetTracer = vi.fn(() => ({ startSpan: mockStartSpan }));
  const mockProviderRegister = vi.fn();
  const mockProviderShutdown = vi.fn().mockResolvedValue(undefined);

  return {
    mockSpanSetAttributes,
    mockSpanSetStatus,
    mockSpanAddEvent,
    mockSpanRecordException,
    mockSpanEnd,
    mockStartSpan,
    mockGetTracer,
    mockProviderRegister,
    mockProviderShutdown,
  };
});

const createMockSpan = () => ({
  setAttributes: mockSpanSetAttributes,
  setStatus: mockSpanSetStatus,
  addEvent: mockSpanAddEvent,
  recordException: mockSpanRecordException,
  end: mockSpanEnd,
});

vi.mock("@opentelemetry/api", () => ({
  trace: {
    getTracer: mockGetTracer,
  },
  SpanStatusCode: {
    OK: "OK",
    ERROR: "ERROR",
    UNSET: "UNSET",
  },
  // These are re-exported as types only, need values for runtime
  Span: {},
  Tracer: {},
}));

vi.mock("@opentelemetry/sdk-trace-node", () => ({
  // Must use function() not arrow fn — arrow fns cannot be constructors
  NodeTracerProvider: vi.fn().mockImplementation(function(this: unknown) {
    return {
      register: mockProviderRegister,
      shutdown: mockProviderShutdown,
    };
  }),
}));

vi.mock("@opentelemetry/sdk-trace-base", () => ({
  SimpleSpanProcessor: vi.fn().mockImplementation(function(this: unknown) { return {}; }),
}));

vi.mock("@opentelemetry/exporter-trace-otlp-http", () => ({
  OTLPTraceExporter: vi.fn().mockImplementation(function(this: unknown) { return {}; }),
}));

vi.mock("@opentelemetry/resources", () => ({
  resourceFromAttributes: vi.fn().mockReturnValue({}),
}));

vi.mock("@opentelemetry/semantic-conventions", () => ({
  ATTR_SERVICE_NAME: "service.name",
  ATTR_SERVICE_VERSION: "service.version",
}));

import {
  MCPOTelInstrumentation,
  createNoOpInstrumentation,
} from "../../src/mcp/otel-instrumentation.js";
import type { ToolCallResult, AuditRecord, MCPGatewayEvent } from "../../src/mcp/types.js";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MCPOTelInstrumentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockReturnValue(createMockSpan());
    mockProviderShutdown.mockResolvedValue(undefined);
  });

  // ─── Construction ─────────────────────────────────────────────────────────

  describe("construction", () => {
    it("should call register() on provider when enabled", () => {
      mockProviderRegister.mockClear();

      new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      // register() is called on the NodeTracerProvider instance when enabled
      expect(mockProviderRegister).toHaveBeenCalled();
    });

    it("should NOT call register() when disabled", () => {
      mockProviderRegister.mockClear();

      new MCPOTelInstrumentation({
        enabled: false,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      expect(mockProviderRegister).not.toHaveBeenCalled();
    });

    it("should expose tracer via getTracer() when enabled", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const tracer = otel.getTracer();
      expect(tracer).toBeDefined();
    });

    it("should expose tracer via getTracer() when disabled", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: false,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const tracer = otel.getTracer();
      expect(tracer).toBeDefined();
    });
  });

  // ─── startToolCallSpan ────────────────────────────────────────────────────

  describe("startToolCallSpan", () => {
    it("should start a span with tool name and tenant attributes", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      otel.startToolCallSpan("echo", "tenant-1", "user-1");

      expect(mockStartSpan).toHaveBeenCalledWith(
        "mcp.tool_call",
        expect.objectContaining({
          attributes: expect.objectContaining({
            "mcp.tool.name": "echo",
            "mcp.tenant.id": "tenant-1",
            "mcp.user.id": "user-1",
          }),
        }),
      );
    });

    it("should start a span without user ID when not provided", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      otel.startToolCallSpan("search", "tenant-2");

      const callArgs = mockStartSpan.mock.calls[0];
      expect(callArgs[1].attributes).not.toHaveProperty("mcp.user.id");
    });

    it("should return a span object", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const span = otel.startToolCallSpan("echo", "tenant-1");
      expect(span).toBeDefined();
    });
  });

  // ─── recordToolCallResult ─────────────────────────────────────────────────

  describe("recordToolCallResult", () => {
    it("should set success attributes on span for successful result", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const span = createMockSpan() as any;
      const result = makeToolResult({ success: true, latencyMs: 150, cost: 0.005 });
      otel.recordToolCallResult(span, result);

      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          "mcp.trace.id": "trace-123",
          "mcp.latency.ms": 150,
          "mcp.cost": 0.005,
          "mcp.success": true,
        }),
      );
      expect(span.setStatus).toHaveBeenCalledWith({ code: "OK" });
      expect(span.end).toHaveBeenCalled();
    });

    it("should set error status on span for failed result", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const span = createMockSpan() as any;
      const result = makeToolResult({ success: false, error: "Tool execution failed" });
      otel.recordToolCallResult(span, result);

      expect(span.setStatus).toHaveBeenCalledWith({
        code: "ERROR",
        message: "Tool execution failed",
      });
      expect(span.recordException).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Tool execution failed" }),
      );
      expect(span.end).toHaveBeenCalled();
    });

    it("should record policy actions as span events", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const span = createMockSpan() as any;
      const result = makeToolResult({
        policyActions: [
          { policyId: "rate-limit-policy", action: "allow", reason: "Within limit", timestamp: new Date() },
        ],
      });
      otel.recordToolCallResult(span, result);

      expect(span.addEvent).toHaveBeenCalledWith(
        "policy_action",
        expect.objectContaining({
          "mcp.policy.id": "rate-limit-policy",
          "mcp.policy.action": "allow",
        }),
      );
    });
  });

  // ─── recordAuditAsSpan ────────────────────────────────────────────────────

  describe("recordAuditAsSpan", () => {
    it("should no-op when instrumentation is disabled", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: false,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const record = makeAuditRecord();
      otel.recordAuditAsSpan(record);

      // startSpan should not have been called for audit
      expect(mockStartSpan).not.toHaveBeenCalled();
    });

    it("should create audit span with core attributes", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const record = makeAuditRecord();
      otel.recordAuditAsSpan(record);

      expect(mockStartSpan).toHaveBeenCalledWith(
        "mcp.audit",
        expect.objectContaining({
          attributes: expect.objectContaining({
            "mcp.trace.id": "trace-456",
            "mcp.tenant.id": "tenant-1",
            "mcp.action": "tool_call",
          }),
        }),
      );
    });

    it("should set userId attribute when present", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const record = makeAuditRecord({ userId: "user-42" });
      otel.recordAuditAsSpan(record);

      const callArgs = mockStartSpan.mock.calls[0];
      expect(callArgs[1].attributes).toHaveProperty("mcp.user.id", "user-42");
    });

    it("should record policy references as span events", () => {
      const span = createMockSpan();
      mockStartSpan.mockReturnValueOnce(span);

      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const record = makeAuditRecord({
        decision: {
          allowed: true,
          reason: "ok",
          policyReferences: ["policy-x", "policy-y"],
          traceId: "trace-456",
        },
      });
      otel.recordAuditAsSpan(record);

      expect(span.addEvent).toHaveBeenCalledWith("policy_evaluated", { "mcp.policy.id": "policy-x" });
      expect(span.addEvent).toHaveBeenCalledWith("policy_evaluated", { "mcp.policy.id": "policy-y" });
    });

    it("should set selectedTool attributes when tool was selected", () => {
      const span = createMockSpan();
      mockStartSpan.mockReturnValueOnce(span);

      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const record = makeAuditRecord({
        decision: {
          allowed: true,
          reason: "selected",
          policyReferences: [],
          traceId: "t",
          selectedTool: {
            id: "srv:echo",
            serverId: "srv",
            tool: { name: "echo", description: "Echo" },
            trustTier: "trusted",
            dataClassifications: [],
            costEstimate: 0,
            callCount: 0,
            tags: [],
          },
        },
      });
      otel.recordAuditAsSpan(record);

      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          "mcp.selected.tool.id": "srv:echo",
          "mcp.selected.server.id": "srv",
          "mcp.selected.trust.tier": "trusted",
        }),
      );
    });

    it("should set error status on span when result has error", () => {
      const span = createMockSpan();
      mockStartSpan.mockReturnValueOnce(span);

      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const record = makeAuditRecord({
        result: makeToolResult({ success: false, error: "call failed", latencyMs: 100 }),
      });
      otel.recordAuditAsSpan(record);

      expect(span.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ code: "ERROR" }),
      );
    });

    it("should set OK status on span when result is successful", () => {
      const span = createMockSpan();
      mockStartSpan.mockReturnValueOnce(span);

      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const record = makeAuditRecord({
        result: makeToolResult({ success: true, latencyMs: 50 }),
      });
      otel.recordAuditAsSpan(record);

      expect(span.setStatus).toHaveBeenCalledWith({ code: "OK" });
    });
  });

  // ─── recordGatewayEvent ───────────────────────────────────────────────────

  describe("recordGatewayEvent", () => {
    it("should no-op when instrumentation is disabled", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: false,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      otel.recordGatewayEvent({ type: "tool_called", traceId: "t", toolId: "x", success: true });
      expect(mockStartSpan).not.toHaveBeenCalled();
    });

    it("should record server_connected event", () => {
      const span = createMockSpan();
      mockStartSpan.mockReturnValueOnce(span);

      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const event: MCPGatewayEvent = { type: "server_connected", serverId: "srv-1", toolCount: 5 };
      otel.recordGatewayEvent(event);

      expect(mockStartSpan).toHaveBeenCalledWith("mcp.event.server_connected");
      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({ "mcp.server.id": "srv-1", "mcp.tool.count": 5 }),
      );
      expect(span.end).toHaveBeenCalled();
    });

    it("should record server_disconnected event", () => {
      const span = createMockSpan();
      mockStartSpan.mockReturnValueOnce(span);

      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const event: MCPGatewayEvent = {
        type: "server_disconnected",
        serverId: "srv-1",
        reason: "connection lost",
      };
      otel.recordGatewayEvent(event);

      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          "mcp.server.id": "srv-1",
          "mcp.disconnect.reason": "connection lost",
        }),
      );
    });

    it("should record server_error event with error status", () => {
      const span = createMockSpan();
      mockStartSpan.mockReturnValueOnce(span);

      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const event: MCPGatewayEvent = {
        type: "server_error",
        serverId: "srv-1",
        error: "ECONNRESET",
      };
      otel.recordGatewayEvent(event);

      expect(span.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ code: "ERROR" }),
      );
      expect(span.recordException).toHaveBeenCalled();
    });

    it("should record tool_called event with success", () => {
      const span = createMockSpan();
      mockStartSpan.mockReturnValueOnce(span);

      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const event: MCPGatewayEvent = {
        type: "tool_called",
        traceId: "t-1",
        toolId: "srv:echo",
        success: true,
      };
      otel.recordGatewayEvent(event);

      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          "mcp.trace.id": "t-1",
          "mcp.tool.id": "srv:echo",
          "mcp.success": true,
        }),
      );
      expect(span.setStatus).not.toHaveBeenCalled();
    });

    it("should set ERROR status for failed tool_called event", () => {
      const span = createMockSpan();
      mockStartSpan.mockReturnValueOnce(span);

      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const event: MCPGatewayEvent = {
        type: "tool_called",
        traceId: "t-2",
        toolId: "srv:broken",
        success: false,
      };
      otel.recordGatewayEvent(event);

      expect(span.setStatus).toHaveBeenCalledWith({ code: "ERROR" });
    });

    it("should record policy_violation event", () => {
      const span = createMockSpan();
      mockStartSpan.mockReturnValueOnce(span);

      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const event: MCPGatewayEvent = {
        type: "policy_violation",
        traceId: "t-3",
        policyId: "deny-untrusted",
        reason: "Tool trust tier too low",
      };
      otel.recordGatewayEvent(event);

      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          "mcp.policy.id": "deny-untrusted",
          "mcp.violation.reason": "Tool trust tier too low",
        }),
      );
      expect(span.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ code: "ERROR" }),
      );
    });

    it("should record rate_limited event", () => {
      const span = createMockSpan();
      mockStartSpan.mockReturnValueOnce(span);

      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const event: MCPGatewayEvent = {
        type: "rate_limited",
        tenantId: "tenant-heavy",
        limit: 100,
      };
      otel.recordGatewayEvent(event);

      expect(span.setAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          "mcp.tenant.id": "tenant-heavy",
          "mcp.rate.limit": 100,
        }),
      );
      expect(span.setStatus).toHaveBeenCalledWith(
        expect.objectContaining({ code: "ERROR" }),
      );
    });
  });

  // ─── shutdown ─────────────────────────────────────────────────────────────

  describe("shutdown", () => {
    it("should shutdown provider when enabled", async () => {
      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      await otel.shutdown();
      expect(mockProviderShutdown).toHaveBeenCalled();
    });

    it("should not throw when shutting down disabled instrumentation", async () => {
      const otel = new MCPOTelInstrumentation({
        enabled: false,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      await expect(otel.shutdown()).resolves.toBeUndefined();
      expect(mockProviderShutdown).not.toHaveBeenCalled();
    });
  });

  // ─── getTracer ────────────────────────────────────────────────────────────

  describe("getTracer", () => {
    it("should return the tracer", () => {
      const otel = new MCPOTelInstrumentation({
        enabled: true,
        serviceName: "cam-test",
        serviceVersion: "1.0.0",
      });

      const tracer = otel.getTracer();
      expect(tracer).toBeDefined();
    });
  });
});

// ─── createNoOpInstrumentation ────────────────────────────────────────────────

describe("createNoOpInstrumentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartSpan.mockReturnValue(createMockSpan());
  });

  it("should return a disabled instrumentation instance", () => {
    const noop = createNoOpInstrumentation();
    expect(noop).toBeInstanceOf(MCPOTelInstrumentation);
  });

  it("should not create spans for audit records", () => {
    const noop = createNoOpInstrumentation();
    noop.recordAuditAsSpan(makeAuditRecord());
    expect(mockStartSpan).not.toHaveBeenCalled();
  });

  it("should not create spans for gateway events", () => {
    const noop = createNoOpInstrumentation();
    noop.recordGatewayEvent({ type: "tool_called", traceId: "t", toolId: "x", success: true });
    expect(mockStartSpan).not.toHaveBeenCalled();
  });

  it("should still return a span from startToolCallSpan (no-op tracer)", () => {
    const noop = createNoOpInstrumentation();
    const span = noop.startToolCallSpan("tool", "tenant");
    // The no-op tracer (from the mock) returns a mock span — just verify it doesn't throw
    expect(span).toBeDefined();
  });

  it("should shutdown cleanly without error", async () => {
    const noop = createNoOpInstrumentation();
    await expect(noop.shutdown()).resolves.toBeUndefined();
  });
});
