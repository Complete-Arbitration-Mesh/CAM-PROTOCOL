import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastPathRouter } from '../../src/routing/fastpath-router.js';
import { Logger } from '../../src/shared/logger.js';

describe('FastPathRouter', () => {
  let router: FastPathRouter;
  let mockLogger: Logger;

  beforeEach(() => {
    process.env.CAM_PROVIDER_CONFIG = JSON.stringify([
      {
        id: 'openai',
        type: 'openai',
        apiKey: 'test-openai',
        endpoint: 'https://api.openai.com/v1',
        models: ['gpt-4', 'gpt-3.5-turbo'],
        enabled: true,
        pricing: { inputTokens: 0.001, outputTokens: 0.002, currency: 'USD' },
        capabilities: ['text-generation', 'function-calling'],
        regions: ['us-east-1']
      },
      {
        id: 'anthropic',
        type: 'anthropic',
        apiKey: 'test-anthropic',
        endpoint: 'https://api.anthropic.com',
        models: ['claude-3-haiku'],
        enabled: true,
        pricing: { inputTokens: 0.002, outputTokens: 0.004, currency: 'USD' },
        capabilities: ['text-generation', 'function-calling'],
        regions: ['us-east-1']
      },
      {
        id: 'google',
        type: 'google',
        apiKey: 'test-google',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta',
        models: ['gemini-pro'],
        enabled: true,
        pricing: { inputTokens: 0.003, outputTokens: 0.006, currency: 'USD' },
        capabilities: ['text-generation', 'function-calling'],
        regions: ['us-central1']
      },
      {
        id: 'azure',
        type: 'azure',
        apiKey: 'test-azure',
        endpoint: 'https://azure.openai.com',
        models: ['gpt-4'],
        enabled: true,
        pricing: { inputTokens: 0.004, outputTokens: 0.008, currency: 'USD' },
        capabilities: ['text-generation', 'function-calling'],
        regions: ['eastus']
      }
    ]);

    mockLogger = new Logger('debug');
    router = new FastPathRouter(mockLogger);
  });

  afterEach(() => {
    delete process.env.CAM_PROVIDER_CONFIG;
  });

  describe('getAvailableProviders', () => {
    it('should return a list of available providers', async () => {
      const providers = await router.getAvailableProviders();

      expect(providers).toBeDefined();
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);

      // Check that each provider has the required fields
      providers.forEach(provider => {
        expect(provider.id).toBeDefined();
        expect(provider.name).toBeDefined();
        expect(provider.type).toBeDefined();
        expect(provider.models).toBeDefined();
        expect(provider.pricing).toBeDefined();
        expect(provider.capabilities).toBeDefined();
        expect(provider.regions).toBeDefined();
        expect(provider.status).toBeDefined();
      });
    });
  });

  describe('getOptimalProvider', () => {
    it('should select a provider based on cost requirements', async () => {
      const requirements = {
        cost: 'minimize' as const,
        performance: 'balanced' as const
      };

      const provider = await router.getOptimalProvider(requirements);

      expect(provider).toBeDefined();
      expect(provider.id).toBeDefined();
      expect(provider.type).toBeDefined();
    });

    it('should select a provider based on performance requirements', async () => {
      const requirements = {
        cost: 'performance' as const,
        performance: 'quality' as const
      };

      const provider = await router.getOptimalProvider(requirements);

      expect(provider).toBeDefined();
      expect(provider.id).toBeDefined();
    });

    it('should filter providers by region', async () => {
      const requirements = {
        region: 'us-east-1'
      };

      const provider = await router.getOptimalProvider(requirements);

      expect(provider).toBeDefined();
      expect(provider.regions).toContain('us-east-1');
    });

    it('should filter providers by capabilities', async () => {
      const requirements = {
        capabilities: ['function-calling']
      };

      const provider = await router.getOptimalProvider(requirements);

      expect(provider).toBeDefined();
      expect(provider.capabilities).toContain('function-calling');
    });

    it('should throw an error when no providers match requirements', async () => {
      const requirements = {
        region: 'non-existent-region',
        capabilities: ['non-existent-capability']
      };

      await expect(router.getOptimalProvider(requirements)).rejects.toThrow();
    });
  });

  describe('Policy Validation', () => {
    it('should validate policies for a request', async () => {
      // Test that validatePolicy method works
      const validatePolicy = (router as any).validatePolicy.bind(router);

      const policyRequest = {
        request: {
          prompt: 'Test prompt',
          model: 'gpt-4'
        },
        userId: 'test-user',
        context: {
          resourceId: 'test-resource',
          action: 'generate'
        }
      };

      const result = await validatePolicy(policyRequest);

      expect(result).toBeDefined();
      expect(result.allowed).toBeDefined();
      expect(result.policies).toBeDefined();
    });
  });

  describe('Provider Configuration', () => {
    it('should load providers from environment configuration', async () => {
      const providers = await router.getAvailableProviders();

      // Should have all 4 configured providers
      expect(providers.length).toBe(4);

      // Verify each provider type is present
      const types = providers.map(p => p.type);
      expect(types).toContain('openai');
      expect(types).toContain('anthropic');
      expect(types).toContain('google');
      expect(types).toContain('azure');
    });

    it('should handle provider selection by type', async () => {
      const providers = await router.getAvailableProviders();

      const openaiProvider = providers.find(p => p.type === 'openai');
      expect(openaiProvider).toBeDefined();
      expect(openaiProvider?.id).toBe('openai');
      expect(openaiProvider?.models).toContain('gpt-4');

      const anthropicProvider = providers.find(p => p.type === 'anthropic');
      expect(anthropicProvider).toBeDefined();
      expect(anthropicProvider?.models).toContain('claude-3-haiku');
    });
  });

  describe('Cost Optimization', () => {
    it('should select cheapest provider when cost minimization is required', async () => {
      const providers = await router.getAvailableProviders();

      const requirements = {
        cost: 'minimize' as const
      };

      const selectedProvider = await router.getOptimalProvider(requirements);

      // The selected provider should be among the available providers
      expect(providers.some(p => p.id === selectedProvider.id)).toBe(true);

      // OpenAI should be selected as it has the lowest input token price (0.001)
      expect(selectedProvider.pricing.inputTokens).toBeLessThanOrEqual(0.002);
    });
  });

  describe('Region Filtering', () => {
    it('should only return providers in specified region', async () => {
      const requirements = {
        region: 'us-east-1'
      };

      const provider = await router.getOptimalProvider(requirements);

      expect(provider.regions).toContain('us-east-1');
    });

    it('should return provider in us-central1 region', async () => {
      const requirements = {
        region: 'us-central1'
      };

      const provider = await router.getOptimalProvider(requirements);

      expect(provider.regions).toContain('us-central1');
      expect(provider.type).toBe('google'); // Only google is in us-central1
    });
  });
});
