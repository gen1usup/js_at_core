import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  CleanupRegistry,
  PlatformLogger,
  ResourceRegistry
} from '@automation-platform/contracts';
import { createFailureBundle } from './index';

const noopLogger: PlatformLogger = {
  child: () => noopLogger,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined
};

const noopCleanup: CleanupRegistry = {
  add: () => undefined,
  runAll: async () => []
};

const noopResources: ResourceRegistry = {
  register: () => undefined,
  get: () => undefined,
  list: () => [],
  remove: () => undefined,
  clear: () => undefined
};

describe('diagnostics', () => {
  it('creates failure bundle with artifacts', async () => {
    const context = {
      executionId: `exec-${Date.now()}`,
      projectName: 'unit',
      environment: 'test',
      startedAt: new Date(),
      correlationId: 'corr-1',
      capabilityMap: {},
      featureFlags: {},
      logger: noopLogger,
      resources: noopResources,
      cleanup: noopCleanup
    };

    const bundle = await createFailureBundle({
      context,
      stepName: 'click submit',
      error: new Error('boom'),
      uiProvider: {
        screenshot: async (filePath: string) => {
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, 'binary', 'utf8');
        },
        html: async () => '<html><body>error</body></html>',
        url: async () => 'https://example.org/fail',
        cookies: async () => [{ name: 'session', value: 'x' }],
        localStorage: async () => ({ key: 'value' }),
        sessionStorage: async () => ({ key: 'value' })
      },
      apiTraces: [
        {
          request: {
            method: 'GET',
            url: '/health',
            status: 500,
            durationMs: 20
          },
          timestampIso: new Date().toISOString()
        }
      ]
    });

    expect(bundle.artifacts.length).toBeGreaterThan(0);
    expect(bundle.summary.failedStep).toBe('click submit');
  });
});
