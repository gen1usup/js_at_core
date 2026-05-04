import { describe, expect, it } from 'vitest';
import type { PlatformLogger } from '@automation-platform/contracts';
import { createExecutionContext, StepRunner } from './index';

const noopLogger: PlatformLogger = {
  child: () => noopLogger,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined
};

describe('execution', () => {
  it('runs step with retry policy', async () => {
    const context = createExecutionContext({
      projectName: 'demo',
      environment: 'test',
      capabilityMap: {},
      featureFlags: {},
      logger: noopLogger
    });

    const runner = new StepRunner(context);
    let attempts = 0;

    const result = await runner.run(
      'unstable-step',
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error('fail first');
        }
        return 42;
      },
      {
        retryPolicy: {
          maxAttempts: 3,
          delayMs: 1,
          backoffFactor: 1
        },
        timeoutMs: 200
      }
    );

    expect(result.data).toBe(42);
    expect(attempts).toBe(2);
  });
});
