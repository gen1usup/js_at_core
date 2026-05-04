import { describe, expect, it } from 'vitest';
import type { PlatformLogger } from '@automation-platform/contracts';
import { InMemoryDeadLetterQueueAdapter, InMemoryQueueClient, QueueWaiter } from './index';

const noopLogger: PlatformLogger = {
  child: () => noopLogger,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined
};

describe('queue-core', () => {
  it('publishes and waits for correlation id', async () => {
    const client = new InMemoryQueueClient(noopLogger);
    const waiter = new QueueWaiter(client, noopLogger);

    const published = await client.publish({
      queue: 'jobs',
      payload: { task: 'sync' },
      correlationId: 'corr-1'
    });

    const found = await waiter.waitForCorrelation('jobs', 'corr-1', {
      timeoutMs: 500,
      pollingIntervalMs: 10
    });

    expect(found.id).toBe(published.id);
  });

  it('moves messages to dead-letter queue', async () => {
    const client = new InMemoryQueueClient(noopLogger);
    const dlq = new InMemoryDeadLetterQueueAdapter(client);

    const message = await client.publish({
      queue: 'jobs',
      payload: { id: 1 },
      correlationId: 'corr-dlq'
    });

    await dlq.moveToDeadLetter('jobs', message);
    const dlqMessages = await dlq.readDeadLetter<{ id: number }>('jobs');

    expect(dlqMessages.length).toBe(1);
    expect(dlqMessages[0]?.correlationId).toBe('corr-dlq');
  });
});
