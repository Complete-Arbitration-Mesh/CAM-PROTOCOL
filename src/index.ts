// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025 Andrew "Dru" Edwards. All rights reserved.
// Main entry point for the Complete Arbitration Mesh

export { CompleteArbitrationMesh } from "./core/complete-arbitration-mesh.js";
export { CAMClient } from "./client/cam-client.js";

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
  Session,
} from "./shared/types.js";

// Utilities and helpers
export { Logger } from "./shared/logger.js";
export { Config } from "./shared/config.js";
export { validateRequest } from "./shared/validation.js";

// Error classes
export {
  CAMError,
  RoutingError,
  CollaborationError,
  AuthenticationError,
  ValidationError,
} from "./shared/errors.js";

// Constants
export { VERSION, API_VERSION } from "./shared/constants.js";

// Licensing - Edition management
export {
  LicenseManager,
  LicenseError,
  licenseManager,
  checkFeature,
  requireFeature,
} from "./licensing/index.js";

export type {
  Edition,
  EditionFeatures,
  LicenseInfo,
} from "./licensing/index.js";

// Payment and subscription exports (Pro/Enterprise feature)
export {
  StripeService,
  SubscriptionManager,
  PaymentAPI,
} from "./payment/index.js";

export type {
  StripeServiceOptions,
  CustomerData,
  SubscriptionData,
  CheckoutSessionOptions,
  SubscriptionTier,
  SubscriptionFeatures,
  SubscriptionInfo,
  SubscriptionManagerOptions,
  PaymentAPIOptions,
} from "./payment/index.js";
