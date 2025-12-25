import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CacheManager, CacheManagerOptions } from '../../src/routing/cache-manager.js';
import type { AICoreRequest, AICoreResponse } from '../../src/shared/types.js';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  const createRequest = (prompt: string, model?: string, temperature?: number): AICoreRequest => ({
    prompt,
    model,
    temperature
  });

  const createResponse = (content: string, cost: number = 0.01): AICoreResponse => ({
    content,
    provider: 'test-provider',
    model: 'test-model',
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150
    },
    cost,
    latency: 500,
    metadata: {
      provider: 'test-provider',
      timestamp: new Date().toISOString()
    }
  });

  beforeEach(() => {
    cacheManager = new CacheManager({
      maxEntries: 100,
      defaultTtlMs: 60000, // 1 minute
      enabled: true
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for identical requests', () => {
      const request = createRequest('Hello, world!', 'gpt-4', 0.7);
      const key1 = cacheManager.generateCacheKey(request);
      const key2 = cacheManager.generateCacheKey(request);
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different prompts', () => {
      const request1 = createRequest('Hello', 'gpt-4', 0.7);
      const request2 = createRequest('Goodbye', 'gpt-4', 0.7);
      const key1 = cacheManager.generateCacheKey(request1);
      const key2 = cacheManager.generateCacheKey(request2);
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different models', () => {
      const request1 = createRequest('Hello', 'gpt-4', 0.7);
      const request2 = createRequest('Hello', 'gpt-3.5-turbo', 0.7);
      const key1 = cacheManager.generateCacheKey(request1);
      const key2 = cacheManager.generateCacheKey(request2);
      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different temperatures', () => {
      const request1 = createRequest('Hello', 'gpt-4', 0.5);
      const request2 = createRequest('Hello', 'gpt-4', 0.9);
      const key1 = cacheManager.generateCacheKey(request1);
      const key2 = cacheManager.generateCacheKey(request2);
      expect(key1).not.toBe(key2);
    });

    it('should include provider in key when specified', () => {
      const request = createRequest('Hello', 'gpt-4', 0.7);
      const key1 = cacheManager.generateCacheKey(request, 'openai');
      const key2 = cacheManager.generateCacheKey(request, 'azure');
      expect(key1).not.toBe(key2);
    });

    it('should start cache keys with cam: prefix', () => {
      const request = createRequest('Hello');
      const key = cacheManager.generateCacheKey(request);
      expect(key.startsWith('cam:')).toBe(true);
    });
  });

  describe('Cache Operations', () => {
    it('should store and retrieve cached responses', () => {
      const request = createRequest('Test prompt');
      const response = createResponse('Test response');

      cacheManager.set(request, response);
      const cached = cacheManager.get(request);

      expect(cached).not.toBeNull();
      expect(cached?.content).toBe('Test response');
    });

    it('should return null for cache miss', () => {
      const request = createRequest('Uncached prompt');
      const cached = cacheManager.get(request);
      expect(cached).toBeNull();
    });

    it('should set cost to 0 for cached responses', () => {
      const request = createRequest('Test prompt');
      const response = createResponse('Test response', 0.05);

      cacheManager.set(request, response);
      const cached = cacheManager.get(request);

      expect(cached?.cost).toBe(0);
      expect(cached?.metadata?.['originalCost']).toBe(0.05);
    });

    it('should set latency to 0 for cached responses', () => {
      const request = createRequest('Test prompt');
      const response = createResponse('Test response');

      cacheManager.set(request, response);
      const cached = cacheManager.get(request);

      expect(cached?.latency).toBe(0);
    });

    it('should mark responses as cached', () => {
      const request = createRequest('Test prompt');
      const response = createResponse('Test response');

      cacheManager.set(request, response);
      const cached = cacheManager.get(request);

      expect(cached?.metadata?.['cached']).toBe(true);
    });

    it('should track cache hit count', () => {
      const request = createRequest('Test prompt');
      const response = createResponse('Test response');

      cacheManager.set(request, response);

      // First hit
      let cached = cacheManager.get(request);
      expect(cached?.metadata?.['cacheHitCount']).toBe(1);

      // Second hit
      cached = cacheManager.get(request);
      expect(cached?.metadata?.['cacheHitCount']).toBe(2);
    });
  });

  describe('TTL Handling', () => {
    it('should respect TTL expiration', async () => {
      const shortTtlCache = new CacheManager({
        defaultTtlMs: 50, // 50ms TTL
        enabled: true
      });

      const request = createRequest('TTL test');
      const response = createResponse('TTL response');

      shortTtlCache.set(request, response);

      // Should be cached immediately
      expect(shortTtlCache.get(request)).not.toBeNull();

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be expired now
      expect(shortTtlCache.get(request)).toBeNull();
    });

    it('should allow custom TTL per request', async () => {
      const request = createRequest('Custom TTL');
      const response = createResponse('Custom TTL response');

      // Set with very short TTL
      cacheManager.set(request, response, 50);

      expect(cacheManager.get(request)).not.toBeNull();

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(cacheManager.get(request)).toBeNull();
    });
  });

  describe('Cache Limits', () => {
    it('should evict oldest entries when at capacity', () => {
      const smallCache = new CacheManager({
        maxEntries: 3,
        enabled: true
      });

      // Add 3 entries
      for (let i = 1; i <= 3; i++) {
        const request = createRequest(`Prompt ${i}`);
        const response = createResponse(`Response ${i}`);
        smallCache.set(request, response);
      }

      // All 3 should be cached
      expect(smallCache.size()).toBe(3);

      // Add 4th entry - should evict oldest
      const newRequest = createRequest('Prompt 4');
      const newResponse = createResponse('Response 4');
      smallCache.set(newRequest, newResponse);

      // Should still have 3 entries
      expect(smallCache.size()).toBe(3);

      // First entry should be evicted
      expect(smallCache.get(createRequest('Prompt 1'))).toBeNull();

      // 4th entry should exist
      expect(smallCache.get(createRequest('Prompt 4'))).not.toBeNull();
    });
  });

  describe('Cache Control', () => {
    it('should not cache error responses', () => {
      const request = createRequest('Error test');
      const response = createResponse('Error response');
      response.metadata = { ...response.metadata, error: 'Some error' };

      cacheManager.set(request, response);

      expect(cacheManager.get(request)).toBeNull();
    });

    it('should not cache fallback responses', () => {
      const request = createRequest('Fallback test');
      const response = createResponse('Fallback response');
      response.metadata = { ...response.metadata, fallback: true };

      cacheManager.set(request, response);

      expect(cacheManager.get(request)).toBeNull();
    });

    it('should clear all entries', () => {
      const request1 = createRequest('Prompt 1');
      const request2 = createRequest('Prompt 2');

      cacheManager.set(request1, createResponse('Response 1'));
      cacheManager.set(request2, createResponse('Response 2'));

      expect(cacheManager.size()).toBe(2);

      cacheManager.clear();

      expect(cacheManager.size()).toBe(0);
    });

    it('should clear expired entries', async () => {
      const shortTtlCache = new CacheManager({
        defaultTtlMs: 50,
        enabled: true
      });

      const expiredRequest = createRequest('Expired');
      shortTtlCache.set(expiredRequest, createResponse('Expired response'));

      await new Promise(resolve => setTimeout(resolve, 100));

      // Add a fresh entry
      const freshRequest = createRequest('Fresh');
      shortTtlCache.set(freshRequest, createResponse('Fresh response'));

      // Clear expired
      const cleared = shortTtlCache.clearExpired();

      expect(cleared).toBe(1);
      expect(shortTtlCache.get(freshRequest)).not.toBeNull();
    });
  });

  describe('Disabled Cache', () => {
    it('should not cache when disabled', () => {
      const disabledCache = new CacheManager({ enabled: false });

      const request = createRequest('Disabled test');
      const response = createResponse('Disabled response');

      disabledCache.set(request, response);

      expect(disabledCache.get(request)).toBeNull();
      expect(disabledCache.size()).toBe(0);
    });

    it('should allow enabling/disabling at runtime', () => {
      const request = createRequest('Toggle test');
      const response = createResponse('Toggle response');

      cacheManager.set(request, response);
      expect(cacheManager.get(request)).not.toBeNull();

      cacheManager.setEnabled(false);
      expect(cacheManager.get(request)).toBeNull();

      cacheManager.setEnabled(true);
      cacheManager.set(request, response);
      expect(cacheManager.get(request)).not.toBeNull();
    });

    it('should report enabled status', () => {
      expect(cacheManager.isEnabled()).toBe(true);

      cacheManager.setEnabled(false);
      expect(cacheManager.isEnabled()).toBe(false);
    });
  });

  describe('Cache Statistics', () => {
    it('should track hits and misses', () => {
      const request = createRequest('Stats test');
      const response = createResponse('Stats response');

      // Miss
      cacheManager.get(request);

      // Set and hit
      cacheManager.set(request, response);
      cacheManager.get(request);
      cacheManager.get(request);

      const stats = cacheManager.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });

    it('should calculate hit rate', () => {
      const request = createRequest('Hit rate test');
      const response = createResponse('Hit rate response');

      // 1 miss
      cacheManager.get(request);

      // Set and 3 hits
      cacheManager.set(request, response);
      cacheManager.get(request);
      cacheManager.get(request);
      cacheManager.get(request);

      const stats = cacheManager.getStats();
      expect(stats.hitRate).toBe(0.75); // 3 hits / 4 total
    });

    it('should track total cost saved', () => {
      const request = createRequest('Cost test');
      const response = createResponse('Cost response', 0.02);

      cacheManager.set(request, response);

      // Each hit saves $0.02
      cacheManager.get(request);
      cacheManager.get(request);
      cacheManager.get(request);

      const stats = cacheManager.getStats();
      expect(stats.totalCostSaved).toBe(0.06);
    });

    it('should track entry count', () => {
      for (let i = 0; i < 5; i++) {
        cacheManager.set(
          createRequest(`Prompt ${i}`),
          createResponse(`Response ${i}`)
        );
      }

      const stats = cacheManager.getStats();
      expect(stats.entries).toBe(5);
    });
  });

  describe('Invalidation', () => {
    it('should invalidate specific entries', () => {
      const request = createRequest('Invalidate test');
      const response = createResponse('Invalidate response');

      cacheManager.set(request, response);
      expect(cacheManager.get(request)).not.toBeNull();

      const deleted = cacheManager.invalidate(request);
      expect(deleted).toBe(true);
      expect(cacheManager.get(request)).toBeNull();
    });

    it('should return false when invalidating non-existent entry', () => {
      const request = createRequest('Non-existent');
      const deleted = cacheManager.invalidate(request);
      expect(deleted).toBe(false);
    });
  });
});
