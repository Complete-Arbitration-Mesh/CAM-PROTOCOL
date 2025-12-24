import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { StateManager } from '../../../src/core/state-manager.js';

const testDir = 'tmp';
const testFile = path.join(testDir, 'state-manager-persistence.json');

function cleanup() {
  if (fs.existsSync(testFile)) {
    fs.unlinkSync(testFile);
  }
}

function ensureDir() {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
}

describe('StateManager persistence', () => {
  beforeAll(() => {
    ensureDir();
  });
  afterEach(() => {
    cleanup();
  });

  it('restores state from file backend', () => {
    cleanup();
    const manager = new StateManager({ backend: 'file', storagePath: testFile });
    manager.setRouteState('r1', {
      routeId: 'r1',
      status: 'active',
      lastUpdated: new Date().toISOString(),
      metrics: { requestCount: 1, averageLatency: 10, errorRate: 0 }
    });
    manager.shutdown();

    const manager2 = new StateManager({ backend: 'file', storagePath: testFile });
    const state = manager2.getRouteState('r1');
    expect(state).toBeDefined();
    expect(state?.status).toBe('active');
  });
});
