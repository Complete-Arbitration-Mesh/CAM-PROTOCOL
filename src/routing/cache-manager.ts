/**
 * Cache Manager for AI Response Caching
 *
 * Provides LRU caching with TTL support to reduce costs by caching
 * identical requests. Cache hits are returned instantly at $0 cost.
 */

import { createHash } from 'crypto';
import { Logger } from '../shared/logger.js';
import type { AICoreRequest, AICoreResponse } from '../shared/types.js';

export interface CacheEntry {
  response: AICoreResponse;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  entries: number;
  totalCostSaved: number;
  oldestEntry?: Date | undefined;
  newestEntry?: Date | undefined;
}

export interface CacheManagerOptions {
  maxEntries?: number;      // Max number of cached responses (default: 1000)
  defaultTtlMs?: number;    // Default TTL in milliseconds (default: 5 minutes)
  enabled?: boolean;        // Enable/disable caching (default: true)
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private logger: Logger;
  private maxEntries: number;
  private defaultTtlMs: number;
  private enabled: boolean;

  // Stats tracking
  private hits: number = 0;
  private misses: number = 0;
  private totalCostSaved: number = 0;

  constructor(options: CacheManagerOptions = {}) {
    this.maxEntries = options.maxEntries ?? 1000;
    this.defaultTtlMs = options.defaultTtlMs ?? 5 * 60 * 1000;  // 5 minutes default
    this.enabled = options.enabled ?? true;
    this.logger = new Logger('info');

    this.logger.info('Cache Manager initialized', {
      maxEntries: this.maxEntries,
      defaultTtlMs: this.defaultTtlMs,
      enabled: this.enabled
    });
  }

  /**
   * Generate a cache key from a request
   * Key is based on: prompt, model, temperature (rounded to 2 decimal places)
   */
  generateCacheKey(request: AICoreRequest, providerId?: string): string {
    const keyData = {
      prompt: request.prompt,
      model: request.model || 'default',
      temperature: Math.round((request.temperature ?? 0.7) * 100) / 100,
      provider: providerId || 'any'
    };

    const hash = createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 16);  // Use first 16 chars for shorter keys

    return `cam:${hash}`;
  }

  /**
   * Get a cached response if available and not expired
   */
  get(request: AICoreRequest, providerId?: string): AICoreResponse | null {
    if (!this.enabled) return null;

    const key = this.generateCacheKey(request, providerId);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Cache hit!
    this.hits++;
    entry.hitCount++;
    this.totalCostSaved += entry.response.cost;

    this.logger.debug('Cache hit', {
      key,
      hitCount: entry.hitCount,
      costSaved: entry.response.cost
    });

    // Return a copy with updated metadata
    return {
      ...entry.response,
      metadata: {
        ...entry.response.metadata,
        cached: true,
        cacheKey: key,
        originalCost: entry.response.cost,
        cacheHitCount: entry.hitCount
      },
      cost: 0,  // Cached responses cost nothing
      latency: 0  // Instant response
    };
  }

  /**
   * Store a response in the cache
   */
  set(request: AICoreRequest, response: AICoreResponse, ttlMs?: number, providerId?: string): void {
    if (!this.enabled) return;

    // Don't cache error responses or fallbacks
    if (response.metadata?.['error'] || response.metadata?.['fallback']) {
      return;
    }

    const key = this.generateCacheKey(request, providerId);
    const now = Date.now();
    const expiresAt = now + (ttlMs ?? this.defaultTtlMs);

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    const entry: CacheEntry = {
      response,
      createdAt: now,
      expiresAt,
      hitCount: 0
    };

    this.cache.set(key, entry);

    this.logger.debug('Cached response', {
      key,
      ttlMs: ttlMs ?? this.defaultTtlMs,
      cost: response.cost
    });
  }

  /**
   * Evict the oldest entry from the cache
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.logger.debug('Evicted oldest cache entry', { key: oldestKey });
    }
  }

  /**
   * Clear expired entries from the cache
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.logger.info('Cleared expired cache entries', { count: cleared });
    }

    return cleared;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const count = this.cache.size;
    this.cache.clear();
    this.logger.info('Cache cleared', { entriesRemoved: count });
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    let oldestEntry: Date | undefined;
    let newestEntry: Date | undefined;

    for (const entry of this.cache.values()) {
      const createdDate = new Date(entry.createdAt);
      if (!oldestEntry || createdDate < oldestEntry) {
        oldestEntry = createdDate;
      }
      if (!newestEntry || createdDate > newestEntry) {
        newestEntry = createdDate;
      }
    }

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 1000) / 1000,
      entries: this.cache.size,
      totalCostSaved: Math.round(this.totalCostSaved * 10000) / 10000,
      oldestEntry,
      newestEntry
    };
  }

  /**
   * Enable or disable the cache
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.logger.info(`Cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if caching is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(request: AICoreRequest, providerId?: string): boolean {
    const key = this.generateCacheKey(request, providerId);
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.logger.debug('Cache entry invalidated', { key });
    }
    return deleted;
  }

  /**
   * Get the number of cached entries
   */
  size(): number {
    return this.cache.size;
  }
}
