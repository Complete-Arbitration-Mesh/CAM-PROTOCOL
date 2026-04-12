# MCP Compatibility Matrix

This document describes CAM Protocol's compatibility with the Model Context Protocol (MCP) specification.

## Supported Protocol Versions

| MCP Version | Status | Notes |
|-------------|--------|-------|
| `2025-11-25` | **Supported** (Default) | Latest stable version |
| `2025-06-18` | **Supported** | Previous stable version |

CAM defaults to `2025-11-25` for new connections. You can specify the protocol version in server configuration:

```typescript
{
  id: "my-server",
  name: "My MCP Server",
  transport: "stdio",
  command: "my-mcp-server",
  protocolVersion: "2025-11-25", // Optional, defaults to 2025-11-25
  // ...
}
```

## Supported Transports

| Transport | Status | Configuration |
|-----------|--------|---------------|
| **stdio** | **Full Support** | `command` + optional `args`, `env` |
| **SSE** | **Full Support** | `endpoint` URL |
| **HTTP** | **Partial** | Uses SSE transport internally |

### stdio Transport

Recommended for local MCP servers. CAM spawns the server process and communicates via stdin/stdout.

```typescript
{
  transport: "stdio",
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-filesystem", "/data"],
  env: { "DEBUG": "true" },
}
```

### SSE Transport

For remote MCP servers exposing an SSE endpoint.

```typescript
{
  transport: "sse",
  endpoint: "http://localhost:3001/sse",
}
```

## MCP Capabilities

| Capability | Status | Notes |
|------------|--------|-------|
| **Tools** | **Full Support** | Discovery, invocation, result handling |
| **Resources** | **Full Support** | Discovery, read operations |
| **Prompts** | **Full Support** | Discovery, retrieval |
| **Sampling** | Not Implemented | Planned for future release |
| **Logging** | Partial | Server logs captured but not MCP-specific logging |

## Tested MCP Servers

The following MCP servers have been tested with CAM Protocol:

| Server | Version | Transport | Status | Notes |
|--------|---------|-----------|--------|-------|
| CAM Test Servers (fast/cheap) | 1.0.0 | stdio | **Tested** | Internal test servers |
| CAM SSE Test Server | 1.0.0 | SSE | **Tested** | Internal test server |
| `@modelcontextprotocol/server-filesystem` | ^1.0.0 | stdio | **Compatible** | Official MCP filesystem server |
| `@modelcontextprotocol/server-github` | ^1.0.0 | stdio | **Compatible** | Official MCP GitHub server |
| `@modelcontextprotocol/server-sqlite` | ^1.0.0 | stdio | **Compatible** | Official MCP SQLite server |

## Known Limitations

### Transport Limitations

1. **HTTP Transport**: Currently implemented as SSE. True HTTP transport (request/response) is planned.
2. **WebSocket**: Not currently supported. Under consideration for future releases.

### Protocol Limitations

1. **Streaming Results**: Tool results are returned as complete responses. Streaming tool output is not supported.
2. **Progress Notifications**: Not yet implemented for long-running tool calls.
3. **Cancellation**: Tool call cancellation is not supported.

### Feature Limitations

1. **Sampling**: The MCP sampling capability is not implemented.
2. **Notifications**: Server-initiated notifications are not processed.
3. **Session Persistence**: Sessions are not persisted across gateway restarts.

## Error Handling

CAM implements the following error handling for MCP operations:

| Error Type | Handling | User Impact |
|------------|----------|-------------|
| Connection Failure | Logged, server marked disconnected | Tool calls fail gracefully |
| Timeout | Configurable per-server timeout | Returns error result with trace |
| Invalid Response | Logged with details | Returns error result |
| Server Crash | Auto-detected, marked disconnected | Subsequent calls fail |

### Timeout Configuration

```typescript
{
  id: "my-server",
  timeout: 30000, // 30 seconds per-server timeout
  // ...
}

// Or globally:
{
  defaults: {
    timeout: 30000, // Default for all servers
  }
}
```

## SDK Dependency

CAM uses the official MCP SDK:

```json
{
  "@modelcontextprotocol/sdk": "^1.25.1"
}
```

## Testing Your MCP Server

To verify your MCP server works with CAM:

1. **Add to configuration**:
```typescript
const config: MCPGatewayConfig = {
  servers: [
    {
      id: "my-server",
      name: "My Custom Server",
      transport: "stdio",
      command: "my-mcp-server",
      trustTier: "standard",
      enabled: true,
    },
  ],
  // ...
};
```

2. **Run the E2E test**:
```bash
npm run test:mcp:demo
```

3. **Check connection status**:
```bash
curl http://localhost:8080/health
curl http://localhost:8080/tools
```

## Reporting Compatibility Issues

If you encounter compatibility issues with an MCP server:

1. Check the server implements the MCP spec correctly
2. Verify the transport configuration
3. Check logs for connection/protocol errors
4. Open an issue at [GitHub Issues](https://github.com/Complete-Arbitration-Mesh/CAM-PROTOCOL/issues) with:
   - MCP server name and version
   - Transport type
   - Error messages
   - Expected vs actual behavior

## Future Roadmap

| Feature | Priority | Target |
|---------|----------|--------|
| WebSocket Transport | Medium | v2.2 |
| Sampling Support | Low | v2.3 |
| Progress Notifications | Medium | v2.2 |
| Streaming Results | High | v2.2 |
| Auto-reconnect | High | v2.2 |

---

*Last updated: 2025-12-26*
*CAM Protocol Version: 2.1.1*
*MCP SDK Version: 1.25.1*
