import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AuthenticationService } from '../../../src/core/auth-service.js';

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  const mockConfig = {
    jwtSecret: 'test-secret-key-for-testing-purposes',
    tokenExpiry: '1h'
  };

  beforeEach(() => {
    authService = new AuthenticationService(mockConfig);
  });

  afterEach(() => {
    authService.shutdown();
  });

  describe('API Key Authentication', () => {
    it('should authenticate with valid API key', async () => {
      const authRequest = {
        clientId: 'test-client-123',
        type: 'api_key' as const,
        credentials: {
          apiKey: 'cam_test-api-key-123'
        }
      };

      const response = await authService.authenticate(authRequest);

      expect(response.success).toBe(true);
      expect(response.token).toBeDefined();
      expect(response.token?.token).toBeDefined();
      expect(response.userInfo).toBeDefined();
      expect(response.permissions).toBeDefined();
      expect(response.expiresAt).toBeDefined();
    });

    it('should reject invalid API key format', async () => {
      const authRequest = {
        clientId: 'test-client-123',
        type: 'api_key' as const,
        credentials: {
          apiKey: 'invalid-key-format'
        }
      };

      const response = await authService.authenticate(authRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should reject missing API key', async () => {
      const authRequest = {
        clientId: 'test-client-123',
        type: 'api_key' as const,
        credentials: {}
      };

      const response = await authService.authenticate(authRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('OAuth Authentication', () => {
    it('should authenticate with OAuth token', async () => {
      const authRequest = {
        clientId: 'oauth-client-123',
        type: 'oauth' as const,
        credentials: {
          accessToken: 'oauth-access-token-xyz',
          name: 'Test User',
          email: 'test@example.com'
        }
      };

      const response = await authService.authenticate(authRequest);

      expect(response.success).toBe(true);
      expect(response.token).toBeDefined();
      expect(response.userInfo?.name).toBe('Test User');
      expect(response.userInfo?.email).toBe('test@example.com');
    });

    it('should reject missing OAuth token', async () => {
      const authRequest = {
        clientId: 'oauth-client-123',
        type: 'oauth' as const,
        credentials: {}
      };

      const response = await authService.authenticate(authRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Certificate Authentication', () => {
    it('should authenticate with certificate', async () => {
      const authRequest = {
        clientId: 'cert-client-123',
        type: 'certificate' as const,
        credentials: {
          certificate: 'base64-encoded-certificate-data'
        }
      };

      const response = await authService.authenticate(authRequest);

      expect(response.success).toBe(true);
      expect(response.token).toBeDefined();
      expect(response.userInfo).toBeDefined();
    });

    it('should reject missing certificate', async () => {
      const authRequest = {
        clientId: 'cert-client-123',
        type: 'certificate' as const,
        credentials: {}
      };

      const response = await authService.authenticate(authRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Collaboration Authentication', () => {
    it('should authenticate for collaboration session', async () => {
      const authRequest = {
        clientId: 'collab-agent-123',
        type: 'collaboration' as const,
        credentials: {
          sessionToken: 'collaboration-session-token',
          agentName: 'Data Analysis Agent'
        }
      };

      const response = await authService.authenticate(authRequest);

      expect(response.success).toBe(true);
      expect(response.token).toBeDefined();
      expect(response.userInfo?.name).toBe('Data Analysis Agent');
    });

    it('should reject missing session token', async () => {
      const authRequest = {
        clientId: 'collab-agent-123',
        type: 'collaboration' as const,
        credentials: {}
      };

      const response = await authService.authenticate(authRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Token Validation', () => {
    it('should validate correct token', async () => {
      const authRequest = {
        clientId: 'test-client',
        type: 'api_key' as const,
        credentials: {
          apiKey: 'cam_valid-api-key'
        }
      };

      const authResponse = await authService.authenticate(authRequest);
      expect(authResponse.success).toBe(true);
      expect(authResponse.token?.token).toBeDefined();

      const validation = authService.validateToken(authResponse.token!.token);

      expect(validation.valid).toBe(true);
      expect(validation.userInfo).toBeDefined();
      expect(validation.permissions).toBeDefined();
    });

    it('should reject invalid token', () => {
      const validation = authService.validateToken('invalid-token-string');

      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });

    it('should reject malformed tokens', () => {
      const malformedTokens = [
        '',
        'not.a.token',
        'header.payload',
        'invalid-jwt-format'
      ];

      for (const token of malformedTokens) {
        const validation = authService.validateToken(token);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      }
    });
  });

  describe('Token Refresh', () => {
    it('should refresh valid token', async () => {
      // First authenticate
      const authRequest = {
        clientId: 'refresh-test-client',
        type: 'api_key' as const,
        credentials: {
          apiKey: 'cam_refresh-test-key'
        }
      };

      const authResponse = await authService.authenticate(authRequest);
      expect(authResponse.success).toBe(true);
      expect(authResponse.token?.token).toBeDefined();

      // Then refresh
      const refreshResponse = await authService.refreshToken(authResponse.token!.token);

      expect(refreshResponse.success).toBe(true);
      expect(refreshResponse.token).toBeDefined();
      expect(refreshResponse.token?.token).not.toBe(authResponse.token?.token);
    });

    it('should reject refresh of invalid token', async () => {
      const refreshResponse = await authService.refreshToken('invalid-token');

      expect(refreshResponse.success).toBe(false);
      expect(refreshResponse.error).toBeDefined();
    });
  });

  describe('Token Revocation', () => {
    it('should revoke token successfully', async () => {
      const authRequest = {
        clientId: 'revoke-test-client',
        type: 'api_key' as const,
        credentials: {
          apiKey: 'cam_revoke-test-key'
        }
      };

      const authResponse = await authService.authenticate(authRequest);
      expect(authResponse.success).toBe(true);
      expect(authResponse.token?.token).toBeDefined();

      // Revoke the token
      const revoked = authService.revokeToken(authResponse.token!.token);
      expect(revoked).toBe(true);

      // Token should no longer be valid
      const validation = authService.validateToken(authResponse.token!.token);
      expect(validation.valid).toBe(false);
      expect(validation.errorCode).toBe('TOKEN_REVOKED');
    });

    it('should handle revocation of invalid token', () => {
      const revoked = authService.revokeToken('non-existent-token');
      expect(revoked).toBe(false);
    });
  });

  describe('Permission Checking', () => {
    it('should check permissions correctly', async () => {
      const authRequest = {
        clientId: 'perm-test-client',
        type: 'api_key' as const,
        credentials: {
          apiKey: 'cam_permission-test-key'
        }
      };

      const authResponse = await authService.authenticate(authRequest);
      expect(authResponse.success).toBe(true);

      // API key auth grants 'routing' and 'metrics' permissions
      const hasRouting = authService.hasPermission(authResponse.token!.token, 'routing');
      const hasMetrics = authService.hasPermission(authResponse.token!.token, 'metrics');
      const hasAdmin = authService.hasPermission(authResponse.token!.token, 'admin');

      expect(hasRouting).toBe(true);
      expect(hasMetrics).toBe(true);
      expect(hasAdmin).toBe(false);
    });

    it('should return false for invalid token', () => {
      const hasPermission = authService.hasPermission('invalid-token', 'routing');
      expect(hasPermission).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should track active sessions count', async () => {
      const initialCount = authService.getActiveSessionsCount();

      const authRequest = {
        clientId: 'session-test-client',
        type: 'api_key' as const,
        credentials: {
          apiKey: 'cam_session-test-key'
        }
      };

      await authService.authenticate(authRequest);

      const newCount = authService.getActiveSessionsCount();
      expect(newCount).toBe(initialCount + 1);
    });

    it('should cleanup expired sessions', async () => {
      const authRequest = {
        clientId: 'cleanup-test-client',
        type: 'api_key' as const,
        credentials: {
          apiKey: 'cam_cleanup-test-key'
        }
      };

      await authService.authenticate(authRequest);
      const countBefore = authService.getActiveSessionsCount();
      expect(countBefore).toBeGreaterThan(0);

      // Cleanup should not remove non-expired sessions
      authService.cleanupExpiredSessions();
      const countAfter = authService.getActiveSessionsCount();
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing client ID', async () => {
      const authRequest = {
        clientId: '',
        type: 'api_key' as const,
        credentials: {
          apiKey: 'cam_test-key'
        }
      };

      const response = await authService.authenticate(authRequest);

      expect(response.success).toBe(false);
      expect(response.errorCode).toBe('MISSING_CLIENT_ID');
    });

    it('should handle missing credentials', async () => {
      const authRequest = {
        clientId: 'test-client',
        type: 'api_key' as const,
        credentials: undefined as any
      };

      const response = await authService.authenticate(authRequest);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe('Concurrent Authentication', () => {
    it('should handle multiple concurrent authentications', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          authService.authenticate({
            clientId: `concurrent-client-${i}`,
            type: 'api_key',
            credentials: {
              apiKey: `cam_concurrent-key-${i}`
            }
          })
        );
      }

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(10);
      responses.forEach((response) => {
        expect(response.success).toBe(true);
        expect(response.token).toBeDefined();
      });
    });

    it('should handle multiple concurrent validations', async () => {
      const authResponse = await authService.authenticate({
        clientId: 'validation-test-client',
        type: 'api_key',
        credentials: {
          apiKey: 'cam_validation-test-key'
        }
      });

      expect(authResponse.success).toBe(true);

      const validations = [];
      for (let i = 0; i < 10; i++) {
        validations.push(authService.validateToken(authResponse.token!.token));
      }

      expect(validations).toHaveLength(10);
      validations.forEach((validation) => {
        expect(validation.valid).toBe(true);
      });
    });
  });
});
