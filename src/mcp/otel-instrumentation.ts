/**
 * OpenTelemetry Instrumentation for MCP Gateway
 *
 * Exports audit records as OpenTelemetry spans for observability.
 */

import { trace, SpanStatusCode, Span, Tracer } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import type { MCPGatewayEvent, ToolCallResult, AuditRecord } from "./types.js";

export interface OTelConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  exporterUrl?: string | undefined; // OTLP HTTP endpoint, defaults to http://localhost:4318
}

export class MCPOTelInstrumentation {
  private tracer: Tracer;
  private provider: NodeTracerProvider | null = null;
  private config: OTelConfig;

  constructor(config: OTelConfig) {
    this.config = config;

    if (config.enabled) {
      const exporter = new OTLPTraceExporter({
        url: config.exporterUrl || "http://localhost:4318/v1/traces",
      });

      this.provider = new NodeTracerProvider({
        resource: resourceFromAttributes({
          [ATTR_SERVICE_NAME]: config.serviceName,
          [ATTR_SERVICE_VERSION]: config.serviceVersion,
        }),
        spanProcessors: [new SimpleSpanProcessor(exporter)],
      });

      this.provider.register();
    }

    this.tracer = trace.getTracer(config.serviceName, config.serviceVersion);
  }

  /**
   * Create a span for a tool call request
   */
  startToolCallSpan(toolName: string, tenantId: string, userId?: string): Span {
    const span = this.tracer.startSpan("mcp.tool_call", {
      attributes: {
        "mcp.tool.name": toolName,
        "mcp.tenant.id": tenantId,
        ...(userId && { "mcp.user.id": userId }),
      },
    });

    return span;
  }

  /**
   * Record a tool call result to a span
   */
  recordToolCallResult(span: Span, result: ToolCallResult): void {
    span.setAttributes({
      "mcp.trace.id": result.traceId,
      "mcp.server.id": result.serverId,
      "mcp.tool.id": result.toolId,
      "mcp.latency.ms": result.latencyMs,
      "mcp.cost": result.cost,
      "mcp.success": result.success,
    });

    if (result.error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: result.error,
      });
      span.recordException(new Error(result.error));
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    // Record policy actions as events
    for (const action of result.policyActions) {
      span.addEvent("policy_action", {
        "mcp.policy.id": action.policyId,
        "mcp.policy.action": action.action,
        "mcp.policy.reason": action.reason,
      });
    }

    span.end();
  }

  /**
   * Record an audit record as a span
   */
  recordAuditAsSpan(record: AuditRecord): void {
    if (!this.config.enabled) return;

    const span = this.tracer.startSpan("mcp.audit", {
      startTime: record.timestamp,
      attributes: {
        "mcp.trace.id": record.traceId,
        "mcp.tenant.id": record.tenantId,
        ...(record.userId && { "mcp.user.id": record.userId }),
        "mcp.action": record.action,
        ...(record.request.toolName && {
          "mcp.tool.name": record.request.toolName,
        }),
        ...(record.request.resourceUri && {
          "mcp.resource.uri": record.request.resourceUri,
        }),
        "mcp.decision.allowed": record.decision.allowed,
        "mcp.decision.reason": record.decision.reason,
      },
    });

    // Record decision details
    if (record.decision.selectedTool) {
      span.setAttributes({
        "mcp.selected.tool.id": record.decision.selectedTool.id,
        "mcp.selected.server.id": record.decision.selectedTool.serverId,
        "mcp.selected.trust.tier": record.decision.selectedTool.trustTier,
      });
    }

    // Record policy references
    for (const policyRef of record.decision.policyReferences) {
      span.addEvent("policy_evaluated", {
        "mcp.policy.id": policyRef,
      });
    }

    // Record policy actions
    for (const action of record.policyActions) {
      span.addEvent("policy_action", {
        "mcp.policy.id": action.policyId,
        "mcp.policy.action": action.action,
        "mcp.policy.reason": action.reason,
      });
    }

    // Record result if available
    if (record.result) {
      span.setAttributes({
        "mcp.result.success": record.result.success,
        "mcp.result.latency.ms": record.result.latencyMs,
        "mcp.result.cost": record.result.cost,
      });

      if (record.result.error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: record.result.error,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }
    }

    span.end();
  }

  /**
   * Record a gateway event as a span event
   */
  recordGatewayEvent(event: MCPGatewayEvent): void {
    if (!this.config.enabled) return;

    const span = this.tracer.startSpan(`mcp.event.${event.type}`);

    switch (event.type) {
      case "server_connected":
        span.setAttributes({
          "mcp.server.id": event.serverId,
          "mcp.tool.count": event.toolCount,
        });
        break;

      case "server_disconnected":
        span.setAttributes({
          "mcp.server.id": event.serverId,
          "mcp.disconnect.reason": event.reason,
        });
        break;

      case "server_error":
        span.setAttributes({
          "mcp.server.id": event.serverId,
        });
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: event.error,
        });
        span.recordException(new Error(event.error));
        break;

      case "tool_called":
        span.setAttributes({
          "mcp.trace.id": event.traceId,
          "mcp.tool.id": event.toolId,
          "mcp.success": event.success,
        });
        if (!event.success) {
          span.setStatus({ code: SpanStatusCode.ERROR });
        }
        break;

      case "policy_violation":
        span.setAttributes({
          "mcp.trace.id": event.traceId,
          "mcp.policy.id": event.policyId,
          "mcp.violation.reason": event.reason,
        });
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: event.reason,
        });
        break;

      case "rate_limited":
        span.setAttributes({
          "mcp.tenant.id": event.tenantId,
          "mcp.rate.limit": event.limit,
        });
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: "Rate limit exceeded",
        });
        break;
    }

    span.end();
  }

  /**
   * Shutdown the instrumentation
   */
  async shutdown(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
    }
  }

  /**
   * Get the tracer for custom instrumentation
   */
  getTracer(): Tracer {
    return this.tracer;
  }
}

/**
 * Create a no-op instrumentation for when OTel is disabled
 */
export function createNoOpInstrumentation(): MCPOTelInstrumentation {
  return new MCPOTelInstrumentation({
    enabled: false,
    serviceName: "cam-mcp-gateway",
    serviceVersion: "2.1.0",
  });
}
