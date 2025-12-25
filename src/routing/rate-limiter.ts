/**
 * Rate Limiter for CAM Protocol
 *
 * Implements sliding window rate limiting to prevent abuse and ensure
 * fair usage across users and providers. Returns 429 responses with
 * retry-after headers when limits are exceeded.
 */

import { Logger } from "../shared/logger.js";

export interface RateLimitConfig {
  enabled: boolean;
  requestsPerMinute: number; // Default limit per user
  requestsPerMinuteByTier?: {
    // Override by subscription tier
    community: number;
    professional: number;
    enterprise: number;
  };
  providerLimitsPerMinute?: {
    // Per-provider limits
    openai: number;
    anthropic: number;
    google: number;
    azure: number;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfterMs?: number;
}

interface SlidingWindowEntry {
  timestamps: number[]; // Request timestamps within the window
  windowStart: number; // Start of the current window
}

export interface RateLimitStats {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  blockRate: number;
  activeUsers: number;
  activeProviders: number;
}

export class RateLimiter {
  private logger: Logger;
  private config: RateLimitConfig;
  private userWindows: Map<string, SlidingWindowEntry> = new Map();
  private providerWindows: Map<string, SlidingWindowEntry> = new Map();
  private readonly WINDOW_SIZE_MS = 60 * 1000; // 1 minute sliding window
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  // Stats tracking
  private totalRequests: number = 0;
  private blockedRequests: number = 0;

  constructor(config: RateLimitConfig) {
    this.logger = new Logger("info");
    this.config = config;

    this.logger.info("Rate limiter initialized", {
      enabled: config.enabled,
      defaultLimit: config.requestsPerMinute,
    });

    // Clean up old entries periodically (only in non-test environments)
    if (process.env["NODE_ENV"] !== "test") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }
  }

  /**
   * Stop the cleanup interval (for graceful shutdown)
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Check if a request is allowed under rate limits
   * @param userId - The user making the request
   * @param providerId - The provider being called
   * @param tier - Optional subscription tier for tiered limits
   */
  checkLimit(
    userId: string,
    providerId?: string,
    tier?: "community" | "professional" | "enterprise",
  ): RateLimitResult {
    if (!this.config.enabled) {
      return {
        allowed: true,
        remaining: Infinity,
        limit: Infinity,
        resetAt: new Date(Date.now() + this.WINDOW_SIZE_MS),
      };
    }

    this.totalRequests++;
    const now = Date.now();

    // Check user limit first
    const userResult = this.checkUserLimit(userId, tier, now);
    if (!userResult.allowed) {
      this.blockedRequests++;
      this.logger.warn("Rate limit exceeded for user", {
        userId,
        remaining: userResult.remaining,
        retryAfterMs: userResult.retryAfterMs,
      });
      return userResult;
    }

    // Check provider limit if specified
    if (providerId) {
      const providerResult = this.checkProviderLimit(providerId, now);
      if (!providerResult.allowed) {
        this.blockedRequests++;
        this.logger.warn("Rate limit exceeded for provider", {
          providerId,
          remaining: providerResult.remaining,
          retryAfterMs: providerResult.retryAfterMs,
        });
        return providerResult;
      }
    }

    // Request allowed - record it
    this.recordRequest(userId, providerId, now);

    return userResult;
  }

  /**
   * Check user-specific rate limit
   */
  private checkUserLimit(
    userId: string,
    tier: "community" | "professional" | "enterprise" | undefined,
    now: number,
  ): RateLimitResult {
    // Determine limit based on tier
    let limit = this.config.requestsPerMinute;
    if (tier && this.config.requestsPerMinuteByTier) {
      limit = this.config.requestsPerMinuteByTier[tier] || limit;
    }

    const window = this.getOrCreateWindow(this.userWindows, userId, now);
    const requestsInWindow = this.countRequestsInWindow(window, now);
    const remaining = Math.max(0, limit - requestsInWindow);
    const resetAt = new Date(window.windowStart + this.WINDOW_SIZE_MS);

    if (requestsInWindow >= limit) {
      const retryAfterMs = this.calculateRetryAfter(window, limit, now);
      return {
        allowed: false,
        remaining: 0,
        limit,
        resetAt,
        retryAfterMs,
      };
    }

    return {
      allowed: true,
      remaining: remaining - 1, // Subtract 1 for the current request
      limit,
      resetAt,
    };
  }

  /**
   * Check provider-specific rate limit
   */
  private checkProviderLimit(providerId: string, now: number): RateLimitResult {
    // Normalize provider ID to get the type
    const providerType = this.getProviderType(providerId);

    // Get provider-specific limit or use default
    let limit = this.config.requestsPerMinute * 10; // Default: 10x user limit
    if (this.config.providerLimitsPerMinute) {
      const typedLimits = this.config.providerLimitsPerMinute as Record<
        string,
        number
      >;
      limit = typedLimits[providerType] || limit;
    }

    const window = this.getOrCreateWindow(
      this.providerWindows,
      providerId,
      now,
    );
    const requestsInWindow = this.countRequestsInWindow(window, now);
    const remaining = Math.max(0, limit - requestsInWindow);
    const resetAt = new Date(window.windowStart + this.WINDOW_SIZE_MS);

    if (requestsInWindow >= limit) {
      const retryAfterMs = this.calculateRetryAfter(window, limit, now);
      return {
        allowed: false,
        remaining: 0,
        limit,
        resetAt,
        retryAfterMs,
      };
    }

    return {
      allowed: true,
      remaining: remaining - 1,
      limit,
      resetAt,
    };
  }

  /**
   * Record a successful request
   */
  private recordRequest(
    userId: string,
    providerId: string | undefined,
    now: number,
  ): void {
    // Record user request
    const userWindow = this.userWindows.get(userId);
    if (userWindow) {
      userWindow.timestamps.push(now);
    }

    // Record provider request
    if (providerId) {
      const providerWindow = this.providerWindows.get(providerId);
      if (providerWindow) {
        providerWindow.timestamps.push(now);
      }
    }
  }

  /**
   * Get or create a sliding window for an entity
   */
  private getOrCreateWindow(
    windows: Map<string, SlidingWindowEntry>,
    key: string,
    now: number,
  ): SlidingWindowEntry {
    if (!windows.has(key)) {
      windows.set(key, {
        timestamps: [],
        windowStart: now,
      });
    }

    const window = windows.get(key)!;

    // Slide the window - remove timestamps older than WINDOW_SIZE_MS
    const cutoff = now - this.WINDOW_SIZE_MS;
    window.timestamps = window.timestamps.filter((ts) => ts > cutoff);

    // Update window start if needed
    if (window.timestamps.length === 0) {
      window.windowStart = now;
    } else {
      window.windowStart = Math.min(...window.timestamps);
    }

    return window;
  }

  /**
   * Count requests within the sliding window
   */
  private countRequestsInWindow(
    window: SlidingWindowEntry,
    now: number,
  ): number {
    const cutoff = now - this.WINDOW_SIZE_MS;
    return window.timestamps.filter((ts) => ts > cutoff).length;
  }

  /**
   * Calculate how long until a request might be allowed
   */
  private calculateRetryAfter(
    window: SlidingWindowEntry,
    limit: number,
    now: number,
  ): number {
    if (window.timestamps.length === 0) return 0;

    // Sort timestamps and find when the oldest request will expire
    const sorted = [...window.timestamps].sort((a, b) => a - b);

    // We need to wait for enough requests to expire to be under the limit
    const requestsOverLimit = sorted.length - limit + 1;
    if (requestsOverLimit <= 0) return 0;

    // Find when the nth oldest request will expire
    const oldestRelevant = sorted[requestsOverLimit - 1];
    if (oldestRelevant === undefined) return this.WINDOW_SIZE_MS;

    const expiresAt = oldestRelevant + this.WINDOW_SIZE_MS;
    return Math.max(0, expiresAt - now);
  }

  /**
   * Extract provider type from provider ID
   */
  private getProviderType(providerId: string): string {
    // Handle IDs like "openai-primary", "anthropic-1", etc.
    const lower = providerId.toLowerCase();
    if (lower.includes("openai")) return "openai";
    if (lower.includes("anthropic")) return "anthropic";
    if (lower.includes("google") || lower.includes("gemini")) return "google";
    if (lower.includes("azure")) return "azure";
    return "default";
  }

  /**
   * Clean up old window entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.WINDOW_SIZE_MS * 2; // Keep 2 window periods

    for (const [key, window] of this.userWindows) {
      if (
        window.timestamps.length === 0 ||
        Math.max(...window.timestamps) < cutoff
      ) {
        this.userWindows.delete(key);
      }
    }

    for (const [key, window] of this.providerWindows) {
      if (
        window.timestamps.length === 0 ||
        Math.max(...window.timestamps) < cutoff
      ) {
        this.providerWindows.delete(key);
      }
    }

    this.logger.debug("Rate limiter cleanup completed", {
      activeUsers: this.userWindows.size,
      activeProviders: this.providerWindows.size,
    });
  }

  /**
   * Get rate limiting statistics
   */
  getStats(): RateLimitStats {
    const allowedRequests = this.totalRequests - this.blockedRequests;
    return {
      totalRequests: this.totalRequests,
      allowedRequests,
      blockedRequests: this.blockedRequests,
      blockRate:
        this.totalRequests > 0
          ? Math.round((this.blockedRequests / this.totalRequests) * 1000) /
            1000
          : 0,
      activeUsers: this.userWindows.size,
      activeProviders: this.providerWindows.size,
    };
  }

  /**
   * Reset rate limit for a specific user (e.g., after subscription upgrade)
   */
  resetUserLimit(userId: string): void {
    this.userWindows.delete(userId);
    this.logger.info("Rate limit reset for user", { userId });
  }

  /**
   * Check if rate limiting is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Update configuration at runtime
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
    this.logger.info("Rate limiter config updated", {
      enabled: this.config.enabled,
      requestsPerMinute: this.config.requestsPerMinute,
    });
  }
}
