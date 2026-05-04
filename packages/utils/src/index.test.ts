import { describe, expect, it } from 'vitest';
import { retry, waitFor } from './index';

describe('utils', () => {
  it('retries until success', async () => {
    let attempts = 0;

    const result = await retry(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new Error('not yet');
        }
        return 'ok';
      },
      {
        maxAttempts: 4,
        delayMs: 1,
        backoffFactor: 1
      }
    );

    expect(result).toBe('ok');
    expect(attempts).toBe(3);
  });

  it('waits for async condition', async () => {
    let value = 0;

    const result = await waitFor(
      async () => {
        value += 1;
        if (value === 5) {
          return value;
        }
        return undefined;
      },
      {
        timeoutMs: 1_000,
        pollingIntervalMs: 5
      }
    );

    expect(result).toBe(5);
  });
});
