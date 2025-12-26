/**
 * MCP Gateway Module
 *
 * CAM's MCP integration layer - policy, arbitration, and routing for MCP deployments.
 */

export { MCPClient } from "./client.js";
export { MCPToolRegistry } from "./tool-registry.js";
export { MCPGateway } from "./gateway.js";
export {
  MCPOTelInstrumentation,
  createNoOpInstrumentation,
} from "./otel-instrumentation.js";
export type { OTelConfig } from "./otel-instrumentation.js";
export * from "./types.js";
