/**
 * Redis Cache Adapter
 *
 * Provides distributed caching using Redis for horizontal scaling.
 * Implements the same interface as the in-memory CacheManager.
 */

import Redis from "ioredis";
import { createHash } from "crypto";
import { Logger } from "../shared/logger.js";
import type { AICoreRequest, AICoreResponse } from "../shared/types.js";

export interface RedisCacheOptions {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  defaultTtlMs?: number;
  enabled?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface RedisCacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalCostSaved: number;
  connected: boolean;
}

interface CachedEntry {
  response: AICoreResponse;
  createdAt: number;
  hitCount: number;
}

export class RedisCache {
  private client: Redis | null = null;
  private logger: Logger;
  private keyPrefix: string;
  private defaultTtlMs: number;
  private enabled: boolean;

  // Stats (local tracking, not persisted to Redis)
  private hits: number = 0;
  private misses: number = 0;
  private totalCostSaved: number = 0;

  constructor(options: RedisCacheOptions = {}) {
    this.logger = new Logger("info");
    this.keyPrefix = options.keyPrefix || "cam:cache:";
    this.defaultTtlMs = options.defaultTtlMs || 5 * 60 * 1000;
    this.enabled = options.enabled ?? true;

    if (this.enabled) {
      this.connect(options);
    }
  }

  /**
   * Connect to Redis
   */
  private connect(options: RedisCacheOptions): void {
    try {
      const host = options.host || process.env["REDIS_HOST"] || "localhost";
      const port =
        options.port || parseInt(process.env["REDIS_PORT"] || "6379");
      const password = options.password || process.env["REDIS_PASSWORD"];

      // Build connection URL
      let url = `redis://`;
      if (password) {
        url += `:${password}@`;
      }
      url += `${host}:${port}/${options.db || 0}`;

      this.client = new Redis(url, {
        maxRetriesPerRequest: options.maxRetries || 3,
        retryStrategy: (times: number) => {
          if (times > (options.maxRetries || 3)) {
            this.logger.error("Redis connection failed after max retries");
            return null;
          }
          return options.retryDelayMs || Math.min(times * 100, 3000);
        },
        lazyConnect: true,
      });

      this.client.on("connect", () => {
        this.logger.info("Redis cache connected");
      });

      this.client.on("error", (err) => {
        this.logger.error("Redis cache error", { error: err.message });
      });

      this.client.on("close", () => {
        this.logger.warn("Redis cache connection closed");
      });

      // Don't block on connection
      this.client.connect().catch((err) => {
        this.logger.error("Failed to connect to Redis", { error: err.message });
      });
    } catch (error) {
      this.logger.error("Failed to create Redis client", { error });
      this.client = null;
    }
  }

  /**
   * Generate a cache key from a request
   */
  generateCacheKey(request: AICoreRequest, providerId?: string): string {
    const keyData = {
      prompt: request.prompt,
      model: request.model || "default",
      temperature: Math.round((request.temperature ?? 0.7) * 100) / 100,
      provider: providerId || "any",
    };

    const hash = createHash("sha256")
      .update(JSON.stringify(keyData))
      .digest("hex")
      .substring(0, 16);

    return `${this.keyPrefix}${hash}`;
  }

  /**
   * Get a cached response
   */
  async get(
    request: AICoreRequest,
    providerId?: string,
  ): Promise<AICoreResponse | null> {
    if (!this.enabled || !this.client) {
      return null;
    }

    try {
      const key = this.generateCacheKey(request, providerId);
      const data = await this.client.get(key);

      if (!data) {
        this.misses++;
        return null;
      }

      const entry: CachedEntry = JSON.parse(data);
      this.hits++;
      this.totalCostSaved += entry.response.cost;

      // Update hit count
      entry.hitCount++;
      await this.client.set(key, JSON.stringify(entry), "KEEPTTL");

      this.logger.debug("Redis cache hit", {
        key,
        hitCount: entry.hitCount,
        costSaved: entry.response.cost,
      });

      // Return response with cache metadata
      return {
        ...entry.response,
        metadata: {
          ...entry.response.metadata,
          cached: true,
          cacheKey: key,
          originalCost: entry.response.cost,
          cacheHitCount: entry.hitCount,
          cacheBackend: "redis",
        },
        cost: 0,
        latency: 0,
      };
    } catch (error) {
      this.logger.error("Redis cache get error", { error });
      this.misses++;
      return null;
    }
  }

  /**
   * Store a response in the cache
   */
  async set(
    request: AICoreRequest,
    response: AICoreResponse,
    ttlMs?: number,
    providerId?: string,
  ): Promise<void> {
    if (!this.enabled || !this.client) {
      return;
    }

    // Don't cache error or fallback responses
    if (response.metadata?.["error"] || response.metadata?.["fallback"]) {
      return;
    }

    try {
      const key = this.generateCacheKey(request, providerId);
      const ttl = ttlMs ?? this.defaultTtlMs;

      const entry: CachedEntry = {
        response,
        createdAt: Date.now(),
        hitCount: 0,
      };

      await this.client.set(key, JSON.stringify(entry), "PX", ttl);

      this.logger.debug("Redis cache set", {
        key,
        ttlMs: ttl,
        cost: response.cost,
      });
    } catch (error) {
      this.logger.error("Redis cache set error", { error });
    }
  }

  /**
   * Invalidate a specific cache entry
   */
  async invalidate(
    request: AICoreRequest,
    providerId?: string,
  ): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const key = this.generateCacheKey(request, providerId);
      const deleted = await this.client.del(key);
      return deleted > 0;
    } catch (error) {
      this.logger.error("Redis cache invalidate error", { error });
      return false;
    }
  }

  /**
   * Clear all cache entries (with this prefix)
   */
  async clear(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      const keys = await this.client.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      this.logger.info("Redis cache cleared", { keysRemoved: keys.length });
    } catch (error) {
      this.logger.error("Redis cache clear error", { error });
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): RedisCacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 1000) / 1000,
      totalCostSaved: Math.round(this.totalCostSaved * 10000) / 10000,
      connected: this.client?.status === "ready",
    };
  }

  /**
   * Check if cache is enabled and connected
   */
  isEnabled(): boolean {
    return this.enabled && this.client?.status === "ready";
  }

  /**
   * Enable or disable the cache
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.logger.info(`Redis cache ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Get number of cached entries (approximate)
   */
  async size(): Promise<number> {
    if (!this.client) {
      return 0;
    }

    try {
      const keys = await this.client.keys(`${this.keyPrefix}*`);
      return keys.length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Health check
   */
  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.logger.info("Redis cache shutdown complete");
    }
  }
}
