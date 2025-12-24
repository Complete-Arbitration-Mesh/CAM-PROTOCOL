import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../../../src/core/state-manager.js';
import { RouteState, CollaborationState } from '../../../src/shared/types.js';

describe('StateManager', () => {
  let stateManager: StateManager;

  beforeEach(() => {
    stateManager = new StateManager({ maxSnapshots: 10 });
  });

  afterEach(() => {
    stateManager.shutdown();
  });

  describe('Route State Management', () => {
    it('should set and get route state', () => {
      const routeId = 'test-route-1';
      const routeState: RouteState = {
        routeId,
        status: 'active',
        lastUpdated: new Date().toISOString(),
        metadata: { provider: 'openai' },
        metrics: {
          requestCount: 10,
          averageLatency: 234,
          errorRate: 0.01
        }
      };

      stateManager.setRouteState(routeId, routeState);
      const retrievedState = stateManager.getRouteState(routeId);

      expect(retrievedState).toBeDefined();
      expect(retrievedState?.routeId).toBe(routeId);
      expect(retrievedState?.status).toBe('active');
      expect(retrievedState?.metrics?.requestCount).toBe(10);
    });

    it('should update existing route state', () => {
      const routeId = 'test-route-2';
      const initialState: RouteState = {
        routeId,
        status: 'active',
        lastUpdated: new Date().toISOString(),
        metrics: {
          requestCount: 1,
          averageLatency: 234,
          errorRate: 0
        }
      };

      stateManager.setRouteState(routeId, initialState);

      const updatedState: RouteState = {
        ...initialState,
        status: 'inactive',
        metrics: {
          requestCount: 5,
          averageLatency: 200,
          errorRate: 0.02
        }
      };

      stateManager.setRouteState(routeId, updatedState);
      const retrievedState = stateManager.getRouteState(routeId);

      expect(retrievedState?.status).toBe('inactive');
      expect(retrievedState?.metrics?.requestCount).toBe(5);
    });

    it('should return undefined for non-existent route state', () => {
      const state = stateManager.getRouteState('non-existent-route');
      expect(state).toBeUndefined();
    });

    it('should get all route states', () => {
      const routes = ['route-1', 'route-2', 'route-3'];

      routes.forEach((routeId, index) => {
        stateManager.setRouteState(routeId, {
          routeId,
          status: 'active',
          lastUpdated: new Date().toISOString(),
          metrics: {
            requestCount: index + 1,
            averageLatency: 100,
            errorRate: 0
          }
        });
      });

      const allStates = stateManager.getAllRouteStates();
      expect(allStates.size).toBe(3);
    });
  });

  describe('Collaboration State Management', () => {
    it('should set and get collaboration state', () => {
      const sessionId = 'collab-session-1';
      const collabState: CollaborationState = {
        sessionId,
        status: 'active',
        participants: ['agent-1', 'agent-2'],
        lastUpdated: new Date().toISOString(),
        progress: {
          phase: 'analysis',
          completedSteps: 2,
          totalSteps: 5
        }
      };

      stateManager.setCollaborationState(sessionId, collabState);
      const retrievedState = stateManager.getCollaborationState(sessionId);

      expect(retrievedState).toBeDefined();
      expect(retrievedState?.sessionId).toBe(sessionId);
      expect(retrievedState?.status).toBe('active');
      expect(retrievedState?.participants).toEqual(['agent-1', 'agent-2']);
      expect(retrievedState?.progress?.phase).toBe('analysis');
    });

    it('should update collaboration progress', () => {
      const sessionId = 'collab-session-2';
      const initialState: CollaborationState = {
        sessionId,
        status: 'active',
        participants: ['agent-1'],
        lastUpdated: new Date().toISOString(),
        progress: {
          phase: 'initialization',
          completedSteps: 0,
          totalSteps: 5
        }
      };

      stateManager.setCollaborationState(sessionId, initialState);

      const updatedState: CollaborationState = {
        ...initialState,
        progress: {
          phase: 'execution',
          completedSteps: 3,
          totalSteps: 5
        }
      };

      stateManager.setCollaborationState(sessionId, updatedState);
      const retrievedState = stateManager.getCollaborationState(sessionId);

      expect(retrievedState?.progress?.phase).toBe('execution');
      expect(retrievedState?.progress?.completedSteps).toBe(3);
    });

    it('should get all collaboration states', () => {
      const sessions = ['session-1', 'session-2'];

      sessions.forEach((sessionId) => {
        stateManager.setCollaborationState(sessionId, {
          sessionId,
          status: 'active',
          participants: ['agent-1'],
          lastUpdated: new Date().toISOString()
        });
      });

      const allStates = stateManager.getAllCollaborationStates();
      expect(allStates.size).toBe(2);
    });
  });

  describe('State Snapshots', () => {
    it('should create snapshots automatically on state changes', () => {
      stateManager.setRouteState('route-1', {
        routeId: 'route-1',
        status: 'active',
        lastUpdated: new Date().toISOString()
      });

      const snapshots = stateManager.getAllSnapshots();
      expect(snapshots.length).toBeGreaterThan(0);
    });

    it('should get the latest snapshot', () => {
      stateManager.setRouteState('route-1', {
        routeId: 'route-1',
        status: 'active',
        lastUpdated: new Date().toISOString()
      });

      const snapshot = stateManager.getSnapshot();
      expect(snapshot).toBeDefined();
      expect(snapshot?.timestamp).toBeDefined();
      expect(snapshot?.routeStates).toBeDefined();
    });

    it('should restore from snapshot', () => {
      // Create initial state
      stateManager.setRouteState('route-1', {
        routeId: 'route-1',
        status: 'active',
        lastUpdated: new Date().toISOString()
      });

      const snapshot = stateManager.getSnapshot();
      expect(snapshot).toBeDefined();

      // Modify state
      stateManager.setRouteState('route-1', {
        routeId: 'route-1',
        status: 'inactive',
        lastUpdated: new Date().toISOString()
      });

      // Restore from snapshot
      if (snapshot) {
        const restored = stateManager.restoreFromSnapshot(snapshot.timestamp);
        expect(restored).toBe(true);
      }
    });
  });

  describe('State Change Listeners', () => {
    it('should notify listeners on state changes', () => {
      let notified = false;
      let eventType = '';

      stateManager.addStateChangeListener((event) => {
        notified = true;
        eventType = event.type;
      });

      stateManager.setRouteState('route-1', {
        routeId: 'route-1',
        status: 'active',
        lastUpdated: new Date().toISOString()
      });

      expect(notified).toBe(true);
      expect(eventType).toBe('route_state_changed');
    });

    it('should allow removing listeners', () => {
      let callCount = 0;

      const listener = () => { callCount++; };
      stateManager.addStateChangeListener(listener);

      stateManager.setRouteState('route-1', {
        routeId: 'route-1',
        status: 'active',
        lastUpdated: new Date().toISOString()
      });

      stateManager.removeStateChangeListener(listener);

      stateManager.setRouteState('route-2', {
        routeId: 'route-2',
        status: 'active',
        lastUpdated: new Date().toISOString()
      });

      // Should only have been called once (before removal)
      expect(callCount).toBe(1);
    });
  });

  describe('State Cleanup', () => {
    it('should clean up expired route states', () => {
      const expiredTime = new Date(Date.now() - 1000).toISOString();

      stateManager.setRouteState('expired-route', {
        routeId: 'expired-route',
        status: 'active',
        lastUpdated: new Date().toISOString(),
        expiresAt: expiredTime
      });

      stateManager.cleanupExpiredStates();

      const state = stateManager.getRouteState('expired-route');
      expect(state).toBeUndefined();
    });

    it('should not clean up non-expired states', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();

      stateManager.setRouteState('valid-route', {
        routeId: 'valid-route',
        status: 'active',
        lastUpdated: new Date().toISOString(),
        expiresAt: futureTime
      });

      stateManager.cleanupExpiredStates();

      const state = stateManager.getRouteState('valid-route');
      expect(state).toBeDefined();
    });
  });

  describe('Health Metrics', () => {
    it('should return health metrics', () => {
      stateManager.setRouteState('route-1', {
        routeId: 'route-1',
        status: 'active',
        lastUpdated: new Date().toISOString()
      });

      const metrics = stateManager.getHealthMetrics();

      expect(metrics).toHaveProperty('routeStatesCount');
      expect(metrics).toHaveProperty('collaborationStatesCount');
      expect(metrics).toHaveProperty('snapshotsCount');
      expect(metrics).toHaveProperty('listenersCount');
      expect(metrics).toHaveProperty('memoryUsage');

      expect(metrics.routeStatesCount).toBe(1);
      expect(typeof metrics.snapshotsCount).toBe('number');
    });
  });

  describe('Configuration and Metrics API', () => {
    it('should update configuration', async () => {
      const result = await stateManager.updateConfiguration({
        logLevel: 'debug'
      });

      expect(result.success).toBe(true);
      expect(result.updatedFields).toContain('logLevel');
    });

    it('should get metrics', async () => {
      const metrics = await stateManager.getMetrics({
        startTime: new Date(Date.now() - 3600000).toISOString(),
        endTime: new Date().toISOString()
      });

      expect(metrics).toBeDefined();
      expect(metrics.timeRange).toBeDefined();
      expect(metrics.data).toBeDefined();
      expect(Array.isArray(metrics.data)).toBe(true);
    });

    it('should get health status', async () => {
      const health = await stateManager.getHealthStatus();

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent state updates', async () => {
      const promises = [];

      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise<void>((resolve) => {
            stateManager.setRouteState(`concurrent-route-${i}`, {
              routeId: `concurrent-route-${i}`,
              status: 'active',
              lastUpdated: new Date().toISOString(),
              metrics: {
                requestCount: i,
                averageLatency: 100,
                errorRate: 0
              }
            });
            resolve();
          })
        );
      }

      await Promise.all(promises);

      const allStates = stateManager.getAllRouteStates();
      expect(allStates.size).toBe(10);
    });
  });
});
