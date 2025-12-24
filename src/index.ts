// SPDX-License-Identifier: LicenseRef-CAM-Attribution
// Main entry point for the Complete Arbitration Mesh
export { CompleteArbitrationMesh } from './core/complete-arbitration-mesh.js';
export { CAMClient } from './client/cam-client.js';

// Core types and interfaces
export type {
  // Routing types
  AICoreRequest,
  AICoreResponse,
  ProviderRequirements,
  ProviderInfo,
  PolicyValidationRequest,
  PolicyValidationResult,

  // Collaboration types
  CollaborationRequest,
  CollaborationSession,
  CollaborationResult,
  AgentCapabilities,
  AgentInfo,
  ComplexTask,
  TaskComponents,
  CollaborationWorkflow,

  // Shared types
  ConfigurationUpdate,
  ConfigurationResult,
  MetricsQuery,
  MetricsData,
  AuthToken,
  Session
} from './shared/types.js';

// Utilities and helpers
export { Logger } from './shared/logger.js';
export { Config } from './shared/config.js';
export { validateRequest } from './shared/validation.js';

// Error classes
export {
  CAMError,
  RoutingError,
  CollaborationError,
  AuthenticationError,
  ValidationError
} from './shared/errors.js';

// Constants
export { VERSION, API_VERSION } from './shared/constants.js';

// Payment and subscription exports
export {
  StripeService,
  SubscriptionManager,
  PaymentAPI
} from './payment/index.js';

export type {
  StripeServiceOptions,
  CustomerData,
  SubscriptionData,
  CheckoutSessionOptions,
  SubscriptionTier,
  SubscriptionFeatures,
  SubscriptionInfo,
  SubscriptionManagerOptions,
  PaymentAPIOptions
} from './payment/index.js';
