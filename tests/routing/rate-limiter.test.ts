import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, RateLimitConfig } from '../../src/routing/rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;
  const defaultConfig: RateLimitConfig = {
    enabled: true,
    requestsPerMinute: 10,
    requestsPerMinuteByTier: {
      community: 5,
      professional: 20,
      enterprise: 100
    },
    providerLimitsPerMinute: {
      openai: 50,
      anthropic: 50,
      google: 30,
      azure: 40
    }
  };

  beforeEach(() => {
    rateLimiter = new RateLimiter(defaultConfig);
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests under the limit', () => {
      const result = rateLimiter.checkLimit('user-1');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it('should track remaining requests correctly', () => {
      const result1 = rateLimiter.checkLimit('user-1');
      expect(result1.remaining).toBe(9); // 10 - 1

      const result2 = rateLimiter.checkLimit('user-1');
      expect(result2.remaining).toBe(8); // 10 - 2
    });

    it('should block requests when limit is exceeded', () => {
      // Make 10 requests to hit the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit('user-2');
      }

      // 11th request should be blocked
      const result = rateLimiter.checkLimit('user-2');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('should track different users independently', () => {
      // Use up all requests for user-3
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit('user-3');
      }

      // user-3 should be blocked
      const result3 = rateLimiter.checkLimit('user-3');
      expect(result3.allowed).toBe(false);

      // user-4 should still be allowed
      const result4 = rateLimiter.checkLimit('user-4');
      expect(result4.allowed).toBe(true);
    });
  });

  describe('Tier-Based Limits', () => {
    it('should apply community tier limits', () => {
      // Community tier has 5 requests/minute
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit('community-user', undefined, 'community');
      }

      const result = rateLimiter.checkLimit('community-user', undefined, 'community');
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(5);
    });

    it('should apply professional tier limits', () => {
      // Professional tier has 20 requests/minute
      const result = rateLimiter.checkLimit('pro-user', undefined, 'professional');
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(20);
      expect(result.remaining).toBe(19);
    });

    it('should apply enterprise tier limits', () => {
      // Enterprise tier has 100 requests/minute
      const result = rateLimiter.checkLimit('enterprise-user', undefined, 'enterprise');
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(99);
    });
  });

  describe('Provider Rate Limiting', () => {
    it('should track provider limits separately', () => {
      const result = rateLimiter.checkLimit('user-5', 'openai-primary');
      expect(result.allowed).toBe(true);
    });

    it('should identify provider type from provider ID', () => {
      // OpenAI provider
      const openaiResult = rateLimiter.checkLimit('user-6', 'openai-gpt4');
      expect(openaiResult.allowed).toBe(true);

      // Anthropic provider
      const anthropicResult = rateLimiter.checkLimit('user-6', 'anthropic-claude');
      expect(anthropicResult.allowed).toBe(true);
    });
  });

  describe('Disabled Rate Limiting', () => {
    it('should allow all requests when disabled', () => {
      const disabledLimiter = new RateLimiter({
        enabled: false,
        requestsPerMinute: 1
      });

      // Should allow even with limit of 1
      for (let i = 0; i < 100; i++) {
        const result = disabledLimiter.checkLimit('user-7');
        expect(result.allowed).toBe(true);
      }
    });

    it('should return Infinity for remaining when disabled', () => {
      const disabledLimiter = new RateLimiter({
        enabled: false,
        requestsPerMinute: 10
      });

      const result = disabledLimiter.checkLimit('user-8');
      expect(result.remaining).toBe(Infinity);
      expect(result.limit).toBe(Infinity);
    });
  });

  describe('Statistics', () => {
    it('should track total requests', () => {
      rateLimiter.checkLimit('stats-user-1');
      rateLimiter.checkLimit('stats-user-1');
      rateLimiter.checkLimit('stats-user-2');

      const stats = rateLimiter.getStats();
      expect(stats.totalRequests).toBe(3);
    });

    it('should track blocked requests', () => {
      // Make 10 requests to hit the limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit('blocked-user');
      }

      // Make 3 more that will be blocked
      rateLimiter.checkLimit('blocked-user');
      rateLimiter.checkLimit('blocked-user');
      rateLimiter.checkLimit('blocked-user');

      const stats = rateLimiter.getStats();
      expect(stats.blockedRequests).toBe(3);
      expect(stats.totalRequests).toBe(13);
    });

    it('should calculate block rate correctly', () => {
      // 5 allowed, 5 blocked = 50% block rate
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit('rate-user');
      }
      // These will be blocked
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit('rate-user');
      }

      const stats = rateLimiter.getStats();
      expect(stats.blockRate).toBe(0.5);
    });

    it('should track active users', () => {
      rateLimiter.checkLimit('active-1');
      rateLimiter.checkLimit('active-2');
      rateLimiter.checkLimit('active-3');

      const stats = rateLimiter.getStats();
      expect(stats.activeUsers).toBe(3);
    });
  });

  describe('User Limit Reset', () => {
    it('should reset user limits when requested', () => {
      // Use up all requests
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit('reset-user');
      }

      // Should be blocked
      let result = rateLimiter.checkLimit('reset-user');
      expect(result.allowed).toBe(false);

      // Reset the user
      rateLimiter.resetUserLimit('reset-user');

      // Should be allowed again
      result = rateLimiter.checkLimit('reset-user');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });

  describe('Configuration Updates', () => {
    it('should update config at runtime', () => {
      rateLimiter.updateConfig({ requestsPerMinute: 5 });

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        rateLimiter.checkLimit('config-user');
      }

      // 6th should be blocked with new limit
      const result = rateLimiter.checkLimit('config-user');
      expect(result.allowed).toBe(false);
    });

    it('should allow disabling at runtime', () => {
      // Use up limit
      for (let i = 0; i < 10; i++) {
        rateLimiter.checkLimit('disable-user');
      }

      // Should be blocked
      let result = rateLimiter.checkLimit('disable-user');
      expect(result.allowed).toBe(false);

      // Disable rate limiting
      rateLimiter.updateConfig({ enabled: false });

      // Should now be allowed
      result = rateLimiter.checkLimit('disable-user');
      expect(result.allowed).toBe(true);
    });
  });

  describe('isEnabled', () => {
    it('should return true when enabled', () => {
      expect(rateLimiter.isEnabled()).toBe(true);
    });

    it('should return false when disabled', () => {
      const disabledLimiter = new RateLimiter({
        enabled: false,
        requestsPerMinute: 10
      });
      expect(disabledLimiter.isEnabled()).toBe(false);
    });
  });

  describe('Reset Time', () => {
    it('should provide a valid reset time', () => {
      const result = rateLimiter.checkLimit('time-user');
      expect(result.resetAt).toBeInstanceOf(Date);
      expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Shutdown', () => {
    it('should shutdown gracefully', () => {
      // Just ensure no errors are thrown
      expect(() => rateLimiter.shutdown()).not.toThrow();
    });
  });
});
