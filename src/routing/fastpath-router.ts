/**
 * FastPath Router - Core routing engine from original CAM system
 * This preserves all the original CAM routing functionality
 */

import { Logger } from "../shared/logger.js";
import { CAMError } from "../shared/errors.js";
import type {
  AICoreRequest,
  AICoreResponse,
  StreamChunk,
  ProviderRequirements,
  ProviderInfo,
  PolicyValidationRequest,
  PolicyValidationResult,
} from "../shared/types.js";
import type { ProviderConfig } from "../shared/config.js";
import fs from "fs";
import path from "path";
import OpenAI, { AzureOpenAI } from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { CacheManager, CacheStats } from "./cache-manager.js";
import {
  RateLimiter,
  RateLimitConfig,
  RateLimitStats,
} from "./rate-limiter.js";

// Provider health metrics for real-time monitoring
interface ProviderHealthMetrics {
  requestCount: number;
  errorCount: number;
  totalLatency: number;
  latencies: number[]; // Last N latencies for percentile calculation
  lastError?: string;
  lastErrorTime?: Date;
}

export interface FastPathRouterOptions {
  logger?: Logger;
  cacheEnabled?: boolean;
  cacheMaxEntries?: number;
  cacheTtlMs?: number;
  rateLimitConfig?: RateLimitConfig;
}

export class FastPathRouter {
  private logger: Logger;
  private providerConfigs: Record<string, ProviderConfig> = {};
  private healthMetrics: Map<string, ProviderHealthMetrics> = new Map();
  private openaiClients: Map<string, OpenAI> = new Map();
  private anthropicClients: Map<string, Anthropic> = new Map();
  private googleClients: Map<string, GoogleGenerativeAI> = new Map();
  private azureClients: Map<string, AzureOpenAI> = new Map();
  private cacheManager: CacheManager;
  private rateLimiter: RateLimiter;
  private readonly MAX_LATENCY_SAMPLES = 100; // Keep last 100 latencies for percentile calc
  private readonly ERROR_RATE_THRESHOLD = 0.1; // 10% error rate triggers degradation

  constructor(options: FastPathRouterOptions | Logger = {}) {
    // Support both old (Logger) and new (options) constructor signatures
    if (options instanceof Logger) {
      this.logger = options;
      this.cacheManager = new CacheManager();
      this.rateLimiter = new RateLimiter({
        enabled: true,
        requestsPerMinute: 100,
      });
    } else {
      this.logger = options.logger || new Logger("info");
      this.cacheManager = new CacheManager({
        enabled: options.cacheEnabled ?? true,
        maxEntries: options.cacheMaxEntries ?? 1000,
        defaultTtlMs: options.cacheTtlMs ?? 5 * 60 * 1000,
      });
      this.rateLimiter = new RateLimiter(
        options.rateLimitConfig ?? {
          enabled: true,
          requestsPerMinute: 100,
          requestsPerMinuteByTier: {
            community: 60,
            professional: 300,
            enterprise: 1000,
          },
        },
      );
    }
    this.logger.info(
      "FastPath Router initialized with SDK, caching, and rate limiting",
    );
  }

  /**
   * Get or create an OpenAI client for the given provider
   */
  private getOpenAIClient(providerId: string): OpenAI {
    if (!this.openaiClients.has(providerId)) {
      const cfg = this.providerConfigs[providerId];
      if (!cfg)
        throw new CAMError(
          `Missing configuration for provider ${providerId}`,
          "CONFIG_NOT_FOUND",
        );

      const client = new OpenAI({
        apiKey: cfg.apiKey,
        baseURL: cfg.endpoint || undefined,
      });
      this.openaiClients.set(providerId, client);
    }
    return this.openaiClients.get(providerId)!;
  }

  /**
   * Get or create an Anthropic client for the given provider
   */
  private getAnthropicClient(providerId: string): Anthropic {
    if (!this.anthropicClients.has(providerId)) {
      const cfg = this.providerConfigs[providerId];
      if (!cfg)
        throw new CAMError(
          `Missing configuration for provider ${providerId}`,
          "CONFIG_NOT_FOUND",
        );

      const client = new Anthropic({
        apiKey: cfg.apiKey,
        baseURL: cfg.endpoint || undefined,
      });
      this.anthropicClients.set(providerId, client);
    }
    return this.anthropicClients.get(providerId)!;
  }

  /**
   * Get or create a Google AI client for the given provider
   */
  private getGoogleClient(providerId: string): GoogleGenerativeAI {
    if (!this.googleClients.has(providerId)) {
      const cfg = this.providerConfigs[providerId];
      if (!cfg)
        throw new CAMError(
          `Missing configuration for provider ${providerId}`,
          "CONFIG_NOT_FOUND",
        );

      const client = new GoogleGenerativeAI(cfg.apiKey);
      this.googleClients.set(providerId, client);
    }
    return this.googleClients.get(providerId)!;
  }

  /**
   * Get or create an Azure OpenAI client for the given provider
   */
  private getAzureClient(providerId: string): AzureOpenAI {
    if (!this.azureClients.has(providerId)) {
      const cfg = this.providerConfigs[providerId];
      if (!cfg)
        throw new CAMError(
          `Missing configuration for provider ${providerId}`,
          "CONFIG_NOT_FOUND",
        );
      if (!cfg.endpoint)
        throw new CAMError(
          `Azure endpoint required for provider ${providerId}`,
          "CONFIG_INVALID",
        );

      const client = new AzureOpenAI({
        apiKey: cfg.apiKey,
        endpoint: cfg.endpoint,
        apiVersion: "2024-02-15-preview",
      });
      this.azureClients.set(providerId, client);
    }
    return this.azureClients.get(providerId)!;
  }

  /**
   * Record metrics for a provider request
   */
  private recordProviderMetrics(
    providerId: string,
    latency: number,
    success: boolean,
    error?: string,
  ): void {
    if (!this.healthMetrics.has(providerId)) {
      this.healthMetrics.set(providerId, {
        requestCount: 0,
        errorCount: 0,
        totalLatency: 0,
        latencies: [],
      });
    }

    const metrics = this.healthMetrics.get(providerId)!;
    metrics.requestCount++;
    metrics.totalLatency += latency;

    // Keep rolling window of latencies
    metrics.latencies.push(latency);
    if (metrics.latencies.length > this.MAX_LATENCY_SAMPLES) {
      metrics.latencies.shift();
    }

    if (!success && error) {
      metrics.errorCount++;
      metrics.lastError = error;
      metrics.lastErrorTime = new Date();
    } else if (!success) {
      metrics.errorCount++;
    }
  }

  /**
   * Calculate percentile from latency array
   */
  private calculatePercentile(latencies: number[], percentile: number): number {
    if (latencies.length === 0) return 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)] || 0;
  }

  async routeRequest(request: AICoreRequest): Promise<AICoreResponse> {
    this.logger.debug("FastPath routing request", { request });

    try {
      // 0. Check rate limits first (before any processing)
      const userId = (request.metadata?.["userId"] as string) || "anonymous";
      const tier = request.metadata?.["subscriptionTier"] as
        | "community"
        | "professional"
        | "enterprise"
        | undefined;
      const rateLimitResult = this.rateLimiter.checkLimit(
        userId,
        undefined,
        tier,
      );

      if (!rateLimitResult.allowed) {
        throw new CAMError(
          `Rate limit exceeded. Retry after ${Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000)} seconds`,
          "RATE_LIMIT_EXCEEDED",
          {
            details: {
              remaining: rateLimitResult.remaining,
              limit: rateLimitResult.limit,
              resetAt: rateLimitResult.resetAt.toISOString(),
              retryAfterMs: rateLimitResult.retryAfterMs,
            },
          },
        );
      }

      // 1. Validate the request
      await this.validateRequest(request);

      // 2. Apply policies
      const policyResult = await this.applyPolicies(request);
      if (!policyResult.allowed) {
        throw new CAMError(
          `Policy violation: ${policyResult.reason}`,
          "POLICY_VIOLATION",
        );
      }

      // 3. Select optimal provider
      const provider = await this.selectProvider(request.requirements || {});

      // 4. Check cache first (skip cache check if request explicitly disables it)
      if (!request.metadata?.["skipCache"]) {
        const cachedResponse = this.cacheManager.get(request, provider.id);
        if (cachedResponse) {
          this.logger.info("Returning cached response", {
            provider: provider.id,
            cacheKey: cachedResponse.metadata?.["cacheKey"],
            originalCost: cachedResponse.metadata?.["originalCost"],
          });
          return cachedResponse;
        }
      }

      // 5. Route to provider (cache miss)
      const response = await this.executeRequest(request, provider);

      // 6. Cache the response for future requests
      if (!request.metadata?.["skipCache"]) {
        const ttlMs = request.metadata?.["cacheTtlMs"] as number | undefined;
        this.cacheManager.set(request, response, ttlMs, provider.id);
      }

      // 7. Record metrics
      await this.recordMetrics(request, response, provider);

      return response;
    } catch (error) {
      this.logger.error("FastPath routing failed", { error, request });
      throw error;
    }
  }

  /**
   * Route a streaming request through the system
   * Returns an async generator that yields chunks of the response
   */
  async *routeStreamingRequest(
    request: AICoreRequest,
  ): AsyncGenerator<StreamChunk> {
    this.logger.debug("FastPath streaming request", { request });

    // Check rate limits
    const userId = (request.metadata?.["userId"] as string) || "anonymous";
    const tier = request.metadata?.["subscriptionTier"] as
      | "community"
      | "professional"
      | "enterprise"
      | undefined;
    const rateLimitResult = this.rateLimiter.checkLimit(
      userId,
      undefined,
      tier,
    );

    if (!rateLimitResult.allowed) {
      throw new CAMError(
        `Rate limit exceeded. Retry after ${Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000)} seconds`,
        "RATE_LIMIT_EXCEEDED",
      );
    }

    // Validate request
    await this.validateRequest(request);

    // Apply policies
    const policyResult = await this.applyPolicies(request);
    if (!policyResult.allowed) {
      throw new CAMError(
        `Policy violation: ${policyResult.reason}`,
        "POLICY_VIOLATION",
      );
    }

    // Select provider
    const provider = await this.selectProvider(request.requirements || {});
    const model =
      request.model && provider.models.includes(request.model)
        ? request.model
        : provider.models[0] || "default-model";

    // Stream based on provider type
    const startTime = Date.now();

    try {
      switch (provider.type) {
        case "openai":
          yield* this.streamOpenAIRequest(request, provider, model);
          break;
        case "anthropic":
          yield* this.streamAnthropicRequest(request, provider, model);
          break;
        default:
          throw new CAMError(
            `Streaming not supported for provider type: ${provider.type}`,
            "STREAMING_NOT_SUPPORTED",
          );
      }

      const latency = Date.now() - startTime;
      this.recordProviderMetrics(provider.id, latency, true);
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.recordProviderMetrics(provider.id, latency, false, errorMsg);
      throw error;
    }
  }

  /**
   * Stream OpenAI request using SDK
   */
  private async *streamOpenAIRequest(
    request: AICoreRequest,
    provider: ProviderInfo,
    model: string,
  ): AsyncGenerator<StreamChunk> {
    this.loadProviderConfigs();
    const client = this.getOpenAIClient(provider.id);

    const stream = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: request.prompt }],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? null,
      stream: true,
    });

    let totalContent = "";
    let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      const finishReason = chunk.choices[0]?.finish_reason;

      if (content) {
        totalContent += content;
        yield {
          content,
          done: false,
          provider: provider.id,
          model,
        };
      }

      if (finishReason === "stop") {
        // Estimate tokens (OpenAI streaming doesn't provide usage in chunks)
        usage = {
          promptTokens: Math.ceil(request.prompt.length / 4),
          completionTokens: Math.ceil(totalContent.length / 4),
          totalTokens: Math.ceil(
            (request.prompt.length + totalContent.length) / 4,
          ),
        };

        yield {
          content: "",
          done: true,
          provider: provider.id,
          model,
          usage,
        };
      }
    }
  }

  /**
   * Stream Anthropic request using SDK
   */
  private async *streamAnthropicRequest(
    request: AICoreRequest,
    provider: ProviderInfo,
    model: string,
  ): AsyncGenerator<StreamChunk> {
    this.loadProviderConfigs();
    const client = this.getAnthropicClient(provider.id);

    const stream = await client.messages.stream({
      model,
      messages: [{ role: "user", content: request.prompt }],
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens || 1024,
    });

    let inputTokens = 0;
    let outputTokens = 0;

    for await (const event of stream) {
      if (event.type === "content_block_delta") {
        const delta = event.delta;
        if ("text" in delta) {
          yield {
            content: delta.text,
            done: false,
            provider: provider.id,
            model,
          };
        }
      } else if (event.type === "message_delta") {
        // Get usage from final message
        if ("usage" in event && event.usage) {
          outputTokens = event.usage.output_tokens;
        }
      } else if (event.type === "message_start") {
        if ("message" in event && event.message?.usage) {
          inputTokens = event.message.usage.input_tokens;
        }
      }
    }

    // Final chunk with usage
    yield {
      content: "",
      done: true,
      provider: provider.id,
      model,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): CacheStats {
    return this.cacheManager.getStats();
  }

  /**
   * Clear the response cache
   */
  clearCache(): void {
    this.cacheManager.clear();
  }

  /**
   * Enable or disable caching
   */
  setCacheEnabled(enabled: boolean): void {
    this.cacheManager.setEnabled(enabled);
  }

  /**
   * Get rate limiting statistics
   */
  getRateLimitStats(): RateLimitStats {
    return this.rateLimiter.getStats();
  }

  /**
   * Reset rate limit for a specific user
   */
  resetUserRateLimit(userId: string): void {
    this.rateLimiter.resetUserLimit(userId);
  }

  /**
   * Update rate limit configuration
   */
  updateRateLimitConfig(config: Partial<RateLimitConfig>): void {
    this.rateLimiter.updateConfig(config);
  }

  async getOptimalProvider(
    requirements: ProviderRequirements,
  ): Promise<ProviderInfo> {
    this.logger.debug("Getting optimal provider", { requirements });

    // Get all available providers
    const providers = await this.getAvailableProviders();

    if (providers.length === 0) {
      throw new CAMError(
        "No AI providers are currently available",
        "NO_PROVIDERS_AVAILABLE",
      );
    }

    // Filter providers based on requirements
    const eligibleProviders = providers.filter((provider: ProviderInfo) => {
      // Filter by status - only use available or degraded providers
      if (provider.status === "unavailable") return false;

      // Filter by region if specified
      if (
        requirements.region &&
        !provider.regions.includes(requirements.region)
      )
        return false;

      // Filter by capabilities if specified
      if (requirements.capabilities && requirements.capabilities.length > 0) {
        const hasAllCapabilities = requirements.capabilities.every((cap) =>
          provider.capabilities.includes(cap),
        );
        if (!hasAllCapabilities) return false;
      }

      return true;
    });

    if (eligibleProviders.length === 0) {
      throw new CAMError(
        "No providers match the specified requirements",
        "NO_MATCHING_PROVIDERS",
      );
    }

    // Apply scoring based on cost and performance requirements
    const scoredProviders = eligibleProviders.map((provider: ProviderInfo) => {
      let score = 0;

      // Cost scoring
      if (requirements.cost === "minimize") {
        // Prioritize lowest cost
        const costFactor =
          1 -
          (provider.pricing.inputTokens + provider.pricing.outputTokens) / 0.1; // Normalize to 0-1 range
        score += costFactor * 3; // Higher weight for cost minimization
      } else if (requirements.cost === "optimize") {
        // Balance cost and quality
        const costFactor =
          1 -
          (provider.pricing.inputTokens + provider.pricing.outputTokens) / 0.1;
        score += costFactor * 2;
      } else if (requirements.cost === "performance") {
        // Cost is less important
        const costFactor =
          1 -
          (provider.pricing.inputTokens + provider.pricing.outputTokens) / 0.1;
        score += costFactor * 1;
      }

      // Performance scoring
      // For now, we use a simple heuristic based on provider type
      // In a real implementation, this would use historical performance data
      if (requirements.performance === "fast") {
        // Prioritize speed
        if (provider.type === "anthropic") score += 1;
        if (provider.type === "openai") score += 2;
      } else if (requirements.performance === "balanced") {
        // Balance speed and quality
        if (provider.type === "anthropic") score += 2;
        if (provider.type === "openai") score += 2;
        if (provider.type === "google") score += 2;
      } else if (requirements.performance === "quality") {
        // Prioritize quality
        if (provider.type === "anthropic") score += 3;
        if (provider.type === "openai" && provider.models.includes("gpt-4"))
          score += 3;
        if (provider.type === "google") score += 2;
      }

      // Status adjustment - slightly penalize degraded services
      if (provider.status === "degraded") score *= 0.9;

      return { provider, score };
    });

    // Sort by score (highest first) and return the best provider
    scoredProviders.sort(
      (
        a: { provider: ProviderInfo; score: number },
        b: { provider: ProviderInfo; score: number },
      ) => b.score - a.score,
    );

    if (scoredProviders.length === 0) {
      throw new CAMError(
        "No providers match the specified requirements",
        "NO_ELIGIBLE_PROVIDERS",
      );
    }

    // We know scoredProviders has at least one element because we checked length > 0
    // Using non-null assertion operator to inform TypeScript that this is guaranteed to exist
    const selectedProvider = scoredProviders[0]!.provider;
    const topScore = scoredProviders[0]!.score;

    this.logger.info("Selected optimal provider", {
      providerId: selectedProvider.id,
      score: topScore,
      requirements,
    });

    return selectedProvider;
  }

  async validatePolicy(
    request: PolicyValidationRequest,
  ): Promise<PolicyValidationResult> {
    this.logger.debug("Validating policy", { request });

    try {
      // Get applicable policies for this request
      const applicablePolicies = await this.getApplicablePolicies(request);

      if (applicablePolicies.length === 0) {
        // No policies apply, default to allow
        return {
          allowed: true,
          policies: ["default-allow"],
          reason: "No applicable policies found, default allow",
        };
      }

      // Evaluate each policy
      const evaluationResults = await Promise.all(
        applicablePolicies.map((policy) =>
          this.evaluatePolicy(request, policy),
        ),
      );

      // Check if any policy denies the request
      const deniedResults = evaluationResults.filter(
        (result) => !result.allowed,
      );

      if (deniedResults.length > 0) {
        // Request is denied by at least one policy
        // We know deniedResults has at least one element because we checked length > 0
        // Using non-null assertion operator to inform TypeScript that this is guaranteed to exist
        const primaryDenial = deniedResults[0]!;
        return {
          allowed: false,
          policies: evaluationResults.map((result) => result.policy),
          reason: `Policy violation: ${primaryDenial.reason}`,
        };
      }

      // All policies allow the request
      return {
        allowed: true,
        policies: evaluationResults.map((result) => result.policy),
        reason: "Request complies with all applicable policies",
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("Policy validation failed", {
        error: errorMessage,
        request,
      });

      // Default to deny on error for security
      return {
        allowed: false,
        policies: ["error-handler"],
        reason: `Policy validation error: ${errorMessage}`,
      };
    }
  }

  /**
   * Get health status of the routing system with real metrics
   */
  async getHealthStatus(): Promise<any> {
    try {
      // Calculate real metrics from provider health data
      let totalRequests = 0;
      let totalErrors = 0;
      let totalLatency = 0;
      let providersAvailable = 0;
      let providersDegraded = 0;

      const providerDetails: Record<string, any> = {};

      for (const [providerId, metrics] of this.healthMetrics) {
        totalRequests += metrics.requestCount;
        totalErrors += metrics.errorCount;
        totalLatency += metrics.totalLatency;

        const errorRate =
          metrics.requestCount > 0
            ? metrics.errorCount / metrics.requestCount
            : 0;

        const avgLatency =
          metrics.requestCount > 0
            ? Math.round(metrics.totalLatency / metrics.requestCount)
            : 0;

        const status =
          errorRate >= this.ERROR_RATE_THRESHOLD ? "degraded" : "available";
        if (status === "degraded") {
          providersDegraded++;
        } else {
          providersAvailable++;
        }

        providerDetails[providerId] = {
          status,
          requestCount: metrics.requestCount,
          errorCount: metrics.errorCount,
          errorRate: Math.round(errorRate * 1000) / 1000, // 3 decimal places
          averageLatency: avgLatency,
          latencyP50: this.calculatePercentile(metrics.latencies, 50),
          latencyP95: this.calculatePercentile(metrics.latencies, 95),
          latencyP99: this.calculatePercentile(metrics.latencies, 99),
          lastError: metrics.lastError,
          lastErrorTime: metrics.lastErrorTime?.toISOString(),
        };
      }

      const overallErrorRate =
        totalRequests > 0 ? totalErrors / totalRequests : 0;
      const overallAvgLatency =
        totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0;

      // Determine overall status
      let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";
      if (providersDegraded > 0 && providersAvailable === 0) {
        overallStatus = "unhealthy";
      } else if (providersDegraded > 0 || overallErrorRate > 0.05) {
        overallStatus = "degraded";
      }

      // Get rate limiting stats
      const rateLimitStats = this.rateLimiter.getStats();

      // Get cache stats
      const cacheStats = this.cacheManager.getStats();

      return {
        status: overallStatus,
        component: "fastpath_router",
        timestamp: new Date().toISOString(),
        details: {
          providersAvailable,
          providersDegraded,
          totalRequests,
          totalErrors,
          averageLatency: overallAvgLatency,
          errorRate: Math.round(overallErrorRate * 1000) / 1000,
          providers: providerDetails,
          rateLimiting: {
            enabled: this.rateLimiter.isEnabled(),
            totalRequests: rateLimitStats.totalRequests,
            blockedRequests: rateLimitStats.blockedRequests,
            blockRate: rateLimitStats.blockRate,
            activeUsers: rateLimitStats.activeUsers,
          },
          caching: {
            enabled: this.cacheManager.isEnabled(),
            entries: cacheStats.entries,
            hitRate: cacheStats.hitRate,
            totalCostSaved: cacheStats.totalCostSaved,
          },
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        component: "fastpath_router",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Shutdown the router
   */
  async shutdown(): Promise<void> {
    this.logger.info("FastPath Router shutting down");
    // Cleanup logic would go here
  }
  private async validateRequest(request: AICoreRequest): Promise<void> {
    if (!request.prompt || typeof request.prompt !== "string") {
      throw new CAMError(
        "Invalid request: prompt is required",
        "INVALID_REQUEST",
      );
    }
  }

  private async applyPolicies(
    request: AICoreRequest,
  ): Promise<PolicyValidationResult> {
    // Convert AICoreRequest to PolicyValidationRequest
    const policyRequest: PolicyValidationRequest = {
      request: request,
      userId:
        request.metadata && request.metadata["userId"]
          ? (request.metadata["userId"] as string)
          : "anonymous",
      context: {
        resourceId:
          request.metadata && request.metadata["resourceId"]
            ? (request.metadata["resourceId"] as string)
            : "default",
        action: "generate",
        content: request.prompt,
        ...(request.metadata || {}),
      },
    };

    // Validate against policies
    return await this.validatePolicy(policyRequest);
  }

  /**
   * Get applicable policies for a request
   */
  private async getApplicablePolicies(
    request: PolicyValidationRequest,
  ): Promise<string[]> {
    // In a real implementation, this would query a policy database or service
    // For now, return a set of default policies based on request type

    const defaultPolicies = ["content-safety"];

    // Add specific policies based on request type
    if (
      request.request.metadata &&
      request.request.metadata["requestType"] === "ai_completion"
    ) {
      defaultPolicies.push("token-quota");
      defaultPolicies.push("prompt-safety");
    }

    // Add compliance policies if needed
    if (request.context && request.context["compliance"]) {
      const complianceRequirements = request.context["compliance"] as string[];
      if (complianceRequirements.includes("gdpr")) {
        defaultPolicies.push("gdpr-compliance");
      }
      if (complianceRequirements.includes("hipaa")) {
        defaultPolicies.push("hipaa-compliance");
      }
    }

    return defaultPolicies;
  }

  /**
   * Evaluate a specific policy against a request
   */
  private async evaluatePolicy(
    request: PolicyValidationRequest,
    policy: string,
  ): Promise<{
    policy: string;
    allowed: boolean;
    reason: string;
  }> {
    // In a real implementation, this would use a policy engine like OPA
    // For now, implement simple policy checks

    switch (policy) {
      case "content-safety": {
        // Check for prohibited content in the request
        const content = request.request.prompt;
        if (content && this.containsProhibitedContent(content)) {
          return {
            policy,
            allowed: false,
            reason: "Content contains prohibited material",
          };
        }
        break;
      }

      case "token-quota":
        // Check if user has exceeded their token quota
        if (request.context && request.context["userTokenUsage"]) {
          const usage = request.context["userTokenUsage"] as number;
          const quota =
            (request.context["userTokenQuota"] as number) || 1000000;

          if (usage > quota) {
            return {
              policy,
              allowed: false,
              reason: "Token quota exceeded",
            };
          }
        }
        break;

      case "gdpr-compliance":
        // Check for PII processing compliance
        if (
          request.context &&
          request.context["containsPII"] &&
          !(request.context["piiConsent"] as boolean)
        ) {
          return {
            policy,
            allowed: false,
            reason: "GDPR compliance: PII processing requires explicit consent",
          };
        }
        break;

      case "hipaa-compliance":
        // Check for PHI processing compliance
        if (
          request.context &&
          request.context["containsPHI"] &&
          !(request.context["hipaaAuthorization"] as boolean)
        ) {
          return {
            policy,
            allowed: false,
            reason: "HIPAA compliance: PHI processing requires authorization",
          };
        }
        break;
    }

    // Default to allow if no specific violation found
    return {
      policy,
      allowed: true,
      reason: `Policy ${policy} check passed`,
    };
  }

  /**
   * Check if content contains prohibited material
   * This is a simple implementation - a real one would use more sophisticated content filtering
   */
  private containsProhibitedContent(content: string): boolean {
    const prohibitedTerms = [
      "illegal activities",
      "child exploitation",
      "terrorism",
      "self-harm instructions",
      "hate speech",
    ];

    return prohibitedTerms.some((term) =>
      content.toLowerCase().includes(term.toLowerCase()),
    );
  }

  private async selectProvider(
    requirements: ProviderRequirements,
  ): Promise<ProviderInfo> {
    // Implement sophisticated provider selection logic
    // including cost optimization, performance requirements, availability, and load balancing
    return await this.getOptimalProvider(requirements);
  }

  private loadProviderConfigs(): void {
    if (Object.keys(this.providerConfigs).length > 0) return;

    const envConfig = process.env["CAM_PROVIDER_CONFIG"];
    if (envConfig) {
      try {
        const parsed = JSON.parse(envConfig) as ProviderConfig[];
        parsed.forEach((p) => {
          if (p.enabled) this.providerConfigs[p.id] = p;
        });
      } catch (err) {
        this.logger.warn("Failed to parse CAM_PROVIDER_CONFIG", { error: err });
      }
    }

    if (Object.keys(this.providerConfigs).length === 0) {
      const filePath =
        process.env["CAM_PROVIDER_CONFIG_FILE"] ||
        path.resolve("providers.json");
      if (fs.existsSync(filePath)) {
        try {
          const fileData = fs.readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(fileData) as ProviderConfig[];
          parsed.forEach((p) => {
            if (p.enabled) this.providerConfigs[p.id] = p;
          });
        } catch (err) {
          this.logger.warn("Failed to load provider config file", {
            error: err,
          });
        }
      }
    }
  }

  /**
   * Get all available AI providers from the provider registry
   * In a real implementation, this would query a database or service registry
   */
  private async getAvailableProviders(): Promise<ProviderInfo[]> {
    this.loadProviderConfigs();
    return Object.values(this.providerConfigs).map((cfg) => ({
      id: cfg.id,
      name: cfg.id,
      type: cfg.type as any,
      models: (cfg as any).models || [],
      pricing: (cfg as any).pricing || {
        inputTokens: 0,
        outputTokens: 0,
        currency: "USD",
      },
      capabilities: (cfg as any).capabilities || [],
      regions: (cfg as any).regions || [],
      status: cfg.enabled ? "available" : "unavailable",
    }));
  }

  private async executeRequest(
    request: AICoreRequest,
    provider: ProviderInfo,
  ): Promise<AICoreResponse> {
    this.logger.debug("Executing request with provider", {
      providerId: provider.id,
      request,
    });

    const startTime = Date.now();
    let response: AICoreResponse;

    try {
      // Select the model to use - either the one specified in the request or the first available model
      const model =
        request.model && provider.models.includes(request.model)
          ? request.model
          : provider.models[0] || "default-model";

      // Execute the request based on the provider type
      switch (provider.type) {
        case "openai":
          response = await this.executeOpenAIRequest(request, provider, model);
          break;
        case "anthropic":
          response = await this.executeAnthropicRequest(
            request,
            provider,
            model,
          );
          break;
        case "google":
          response = await this.executeGoogleRequest(request, provider, model);
          break;
        case "azure":
          response = await this.executeAzureRequest(request, provider, model);
          break;
        default:
          throw new CAMError(
            `Provider type ${provider.type} is not supported`,
            "UNSUPPORTED_PROVIDER",
          );
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      // Add latency and cost information to the response
      response.latency = latency;

      // Calculate cost based on token usage and provider pricing
      const inputCost =
        (response.usage.promptTokens / 1000) * provider.pricing.inputTokens;
      const outputCost =
        (response.usage.completionTokens / 1000) *
        provider.pricing.outputTokens;
      response.cost = inputCost + outputCost;

      this.logger.info("Request executed successfully", {
        providerId: provider.id,
        model,
        latency,
        cost: response.cost,
        tokens: response.usage.totalTokens,
      });

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error("Failed to execute request", {
        providerId: provider.id,
        error: errorMessage,
      });

      // Fallback to a simulated response in case of error
      const endTime = Date.now();
      const latency = endTime - startTime;
      const model = provider.models[0] || "default-model";

      return {
        content: `Error from ${provider.name}: ${errorMessage}. Fallback response for: ${request.prompt}`,
        provider: provider.id,
        model,
        usage: {
          promptTokens: Math.floor(request.prompt.length / 4),
          completionTokens: 50,
          totalTokens: Math.floor(request.prompt.length / 4) + 50,
        },
        cost: 0.001, // Minimal cost for failed request
        latency,
        metadata: {
          provider: provider.name,
          timestamp: new Date().toISOString(),
          error: errorMessage,
          fallback: true,
        },
      };
    }
  }

  /**
   * Execute a request with OpenAI using the official SDK
   * Provides automatic retries, proper error handling, and streaming support
   */
  private async executeOpenAIRequest(
    request: AICoreRequest,
    provider: ProviderInfo,
    model: string,
  ): Promise<AICoreResponse> {
    // Ensure provider configs are loaded
    this.loadProviderConfigs();

    const startTime = Date.now();

    try {
      const client = this.getOpenAIClient(provider.id);

      const completion = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: request.prompt }],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? null,
      });

      const latency = Date.now() - startTime;
      this.recordProviderMetrics(provider.id, latency, true);

      const content = completion.choices[0]?.message?.content || "";
      const usage = completion.usage;

      return {
        content,
        provider: provider.id,
        model: completion.model,
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
        latency: 0, // Will be set by caller
        cost: 0, // Will be calculated by caller
        metadata: {
          provider: provider.name,
          timestamp: new Date().toISOString(),
          finishReason: completion.choices[0]?.finish_reason,
          sdkVersion: "openai-sdk",
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const latency = Date.now() - startTime;
      this.recordProviderMetrics(provider.id, latency, false, errorMsg);

      // Handle specific OpenAI error types
      if (err instanceof OpenAI.APIError) {
        throw new CAMError(
          `OpenAI API error: ${err.message}`,
          "PROVIDER_ERROR",
        );
      }
      throw new CAMError(errorMsg, "PROVIDER_ERROR");
    }
  }

  /**
   * Execute a request with Anthropic using the official SDK
   * Provides automatic retries, proper error handling, and streaming support
   */
  private async executeAnthropicRequest(
    request: AICoreRequest,
    provider: ProviderInfo,
    model: string,
  ): Promise<AICoreResponse> {
    // Ensure provider configs are loaded
    this.loadProviderConfigs();

    const startTime = Date.now();

    try {
      const client = this.getAnthropicClient(provider.id);

      const message = await client.messages.create({
        model,
        messages: [{ role: "user", content: request.prompt }],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || 1024,
      });

      const latency = Date.now() - startTime;
      this.recordProviderMetrics(provider.id, latency, true);

      // Extract text content from the response
      const content = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      return {
        content,
        provider: provider.id,
        model: message.model,
        usage: {
          promptTokens: message.usage.input_tokens,
          completionTokens: message.usage.output_tokens,
          totalTokens: message.usage.input_tokens + message.usage.output_tokens,
        },
        latency: 0, // Will be set by caller
        cost: 0, // Will be calculated by caller
        metadata: {
          provider: provider.name,
          timestamp: new Date().toISOString(),
          stopReason: message.stop_reason,
          sdkVersion: "anthropic-sdk",
        },
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const latency = Date.now() - startTime;
      this.recordProviderMetrics(provider.id, latency, false, errorMsg);

      // Handle specific Anthropic error types
      if (err instanceof Anthropic.APIError) {
        throw new CAMError(
          `Anthropic API error: ${err.message}`,
          "PROVIDER_ERROR",
        );
      }
      throw new CAMError(errorMsg, "PROVIDER_ERROR");
    }
  }

  /**
   * Execute a request with Google Gemini using the official SDK
   */
  private async executeGoogleRequest(
    request: AICoreRequest,
    provider: ProviderInfo,
    model: string,
  ): Promise<AICoreResponse> {
    this.loadProviderConfigs();
    const startTime = Date.now();

    try {
      const client = this.getGoogleClient(provider.id);
      const generationConfig: Record<string, number> = {
        temperature: request.temperature ?? 0.7,
      };
      if (request.maxTokens !== undefined) {
        generationConfig["maxOutputTokens"] = request.maxTokens;
      }

      const genModel = client.getGenerativeModel({
        model,
        generationConfig,
      });

      const result = await genModel.generateContent(request.prompt);
      const response = result.response;
      const latency = Date.now() - startTime;

      this.recordProviderMetrics(provider.id, latency, true);

      const text = response.text();
      const usage = response.usageMetadata;

      return {
        content: text,
        provider: provider.id,
        model,
        usage: {
          promptTokens: usage?.promptTokenCount || 0,
          completionTokens: usage?.candidatesTokenCount || 0,
          totalTokens: usage?.totalTokenCount || 0,
        },
        latency: 0,
        cost: 0,
        metadata: {
          provider: provider.name,
          timestamp: new Date().toISOString(),
          finishReason: response.candidates?.[0]?.finishReason,
          sdkVersion: "google-generative-ai",
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const latency = Date.now() - startTime;
      this.recordProviderMetrics(provider.id, latency, false, message);
      throw new CAMError(`Google AI error: ${message}`, "PROVIDER_ERROR");
    }
  }

  /**
   * Execute a request with Azure OpenAI using the official SDK
   */
  private async executeAzureRequest(
    request: AICoreRequest,
    provider: ProviderInfo,
    model: string,
  ): Promise<AICoreResponse> {
    this.loadProviderConfigs();
    const startTime = Date.now();

    try {
      const client = this.getAzureClient(provider.id);

      const completion = await client.chat.completions.create({
        model, // This is the deployment name in Azure
        messages: [{ role: "user", content: request.prompt }],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? null,
      });

      const latency = Date.now() - startTime;
      this.recordProviderMetrics(provider.id, latency, true);

      const content = completion.choices[0]?.message?.content || "";
      const usage = completion.usage;

      return {
        content,
        provider: provider.id,
        model: completion.model,
        usage: {
          promptTokens: usage?.prompt_tokens || 0,
          completionTokens: usage?.completion_tokens || 0,
          totalTokens: usage?.total_tokens || 0,
        },
        latency: 0,
        cost: 0,
        metadata: {
          provider: provider.name,
          timestamp: new Date().toISOString(),
          region: request.requirements?.region || "eastus",
          finishReason: completion.choices[0]?.finish_reason,
          sdkVersion: "azure-openai-sdk",
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const latency = Date.now() - startTime;
      this.recordProviderMetrics(provider.id, latency, false, message);
      throw new CAMError(`Azure OpenAI error: ${message}`, "PROVIDER_ERROR");
    }
  }

  private async recordMetrics(
    request: AICoreRequest,
    response: AICoreResponse,
    provider: ProviderInfo,
  ): Promise<void> {
    // Record metrics for monitoring and analytics
    this.logger.debug("Recording routing metrics", {
      provider: provider.id,
      latency: response.latency,
      cost: response.cost,
      tokens: response.usage.totalTokens,
    });
  }
}
