# MCP Gateway OpenTelemetry Integration

The CAM MCP Gateway includes built-in OpenTelemetry (OTel) instrumentation for distributed tracing and observability. This guide covers setup, configuration, and integration with popular observability backends.

## Overview

The MCP Gateway exports traces for:
- **Tool calls** - Each tool invocation creates a span with timing, success/failure, and policy actions
- **Audit records** - All audit entries are exported as spans with full decision context
- **Gateway events** - Server connections, disconnections, rate limits, and policy violations

## Quick Start

### Enable OTel in Gateway Config

```typescript
import { MCPGateway } from '@cam-protocol/complete-arbitration-mesh/mcp';

const gateway = new MCPGateway({
  servers: [...],
  policies: [...],
  // Enable OpenTelemetry
  otel: {
    enabled: true,
    serviceName: 'my-mcp-gateway',
    serviceVersion: '1.0.0',
    exporterUrl: 'http://localhost:4318/v1/traces', // OTLP HTTP endpoint
  },
  // ... other config
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable/disable OTel instrumentation |
| `serviceName` | string | `cam-mcp-gateway` | Service name in traces |
| `serviceVersion` | string | `2.1.0` | Service version in traces |
| `exporterUrl` | string | `http://localhost:4318/v1/traces` | OTLP HTTP exporter endpoint |

## Setting Up Jaeger

Jaeger is a popular open-source distributed tracing system.

### Docker Setup

```yaml
# docker-compose.otel.yml
version: '3.8'

services:
  jaeger:
    image: jaegertracing/all-in-one:1.52
    ports:
      - "16686:16686"  # Jaeger UI
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  cam-gateway:
    build: .
    environment:
      - CAM_OTEL_ENABLED=true
      - CAM_OTEL_EXPORTER_URL=http://jaeger:4318/v1/traces
    depends_on:
      - jaeger
```

### Start the Stack

```bash
docker-compose -f docker-compose.otel.yml up -d
```

### Access Jaeger UI

Open `http://localhost:16686` to view traces.

## Setting Up Grafana Tempo

Tempo is Grafana's distributed tracing backend.

### Docker Setup

```yaml
# docker-compose.tempo.yml
version: '3.8'

services:
  tempo:
    image: grafana/tempo:2.3.1
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml
    ports:
      - "4317:4317"    # OTLP gRPC
      - "4318:4318"    # OTLP HTTP
      - "3200:3200"    # Tempo query

  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3000:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - ./grafana-datasources.yaml:/etc/grafana/provisioning/datasources/datasources.yaml

  cam-gateway:
    build: .
    environment:
      - CAM_OTEL_ENABLED=true
      - CAM_OTEL_EXPORTER_URL=http://tempo:4318/v1/traces
```

### Tempo Configuration

```yaml
# tempo.yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: 0.0.0.0:4317
        http:
          endpoint: 0.0.0.0:4318

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/blocks
```

### Grafana Datasource

```yaml
# grafana-datasources.yaml
apiVersion: 1

datasources:
  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    isDefault: true
```

## Trace Attributes

### Tool Call Spans

Each tool call creates a span with these attributes:

| Attribute | Description |
|-----------|-------------|
| `mcp.tool.name` | Name of the tool being called |
| `mcp.tenant.id` | Tenant making the request |
| `mcp.user.id` | User ID (if provided) |
| `mcp.trace.id` | CAM internal trace ID |
| `mcp.server.id` | MCP server that handled the call |
| `mcp.tool.id` | Full tool ID (server:tool) |
| `mcp.latency.ms` | Call latency in milliseconds |
| `mcp.cost` | Estimated cost of the call |
| `mcp.success` | Whether the call succeeded |

### Audit Spans

Audit records are exported with:

| Attribute | Description |
|-----------|-------------|
| `mcp.action` | Action type (tool_call, resource_access, etc.) |
| `mcp.decision.allowed` | Whether the request was allowed |
| `mcp.decision.reason` | Reason for the decision |
| `mcp.selected.tool.id` | Selected tool ID |
| `mcp.selected.server.id` | Selected server ID |
| `mcp.selected.trust.tier` | Trust tier of selected tool |

### Policy Events

Policy evaluations are recorded as span events:

```
Event: policy_evaluated
  mcp.policy.id: "no-pii-external"

Event: policy_action
  mcp.policy.id: "no-pii-external"
  mcp.policy.action: "deny"
  mcp.policy.reason: "PII detected in request"
```

## Gateway Events

Server lifecycle and rate limiting events:

| Event Type | Attributes |
|------------|------------|
| `server_connected` | `mcp.server.id`, `mcp.tool.count` |
| `server_disconnected` | `mcp.server.id`, `mcp.disconnect.reason` |
| `server_error` | `mcp.server.id`, error details |
| `tool_called` | `mcp.trace.id`, `mcp.tool.id`, `mcp.success` |
| `policy_violation` | `mcp.trace.id`, `mcp.policy.id`, `mcp.violation.reason` |
| `rate_limited` | `mcp.tenant.id`, `mcp.rate.limit` |

## Custom Instrumentation

Access the tracer for custom spans:

```typescript
const gateway = new MCPGateway(config);
const tracer = gateway.getTracer();

// Create custom spans
const span = tracer.startSpan('custom.operation');
try {
  // Your code here
  span.setAttributes({ 'custom.attribute': 'value' });
} finally {
  span.end();
}
```

## Environment Variables

Configure OTel via environment variables:

| Variable | Description |
|----------|-------------|
| `CAM_OTEL_ENABLED` | Set to `true` to enable |
| `CAM_OTEL_SERVICE_NAME` | Override service name |
| `CAM_OTEL_SERVICE_VERSION` | Override service version |
| `CAM_OTEL_EXPORTER_URL` | OTLP HTTP endpoint |

## Troubleshooting

### No Traces Appearing

1. Verify OTel is enabled in config:
   ```typescript
   console.log(gateway.getStats()); // Check if OTel is configured
   ```

2. Check exporter URL is reachable:
   ```bash
   curl -v http://localhost:4318/v1/traces
   ```

3. Verify the collector is running:
   ```bash
   docker logs jaeger  # or tempo
   ```

### Missing Attributes

Ensure audit config includes arguments:
```typescript
audit: {
  enabled: true,
  includeArguments: true,  // Required for full context
  includeResults: false,   // Optional, may be large
}
```

### Performance Impact

OTel adds minimal overhead (~1-2ms per span). For high-throughput scenarios:

- Use `BatchSpanProcessor` instead of `SimpleSpanProcessor`
- Increase batch size and export interval
- Consider sampling for very high volumes

## Integration with Existing OTel Setup

If you already have OTel configured in your application, you can disable the built-in provider and use the global tracer:

```typescript
import { trace } from '@opentelemetry/api';

// Your existing OTel setup...
const provider = new NodeTracerProvider({...});
provider.register();

// Create gateway without built-in OTel
const gateway = new MCPGateway({
  ...config,
  otel: { enabled: false },  // Disable built-in
});

// The gateway will use the global tracer automatically
```

## See Also

- [MCP Gateway Overview](../architecture/MCP-ENHANCEMENT-PLAN.md)
- [Observability Guide](../observability.md)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
