import { z } from 'zod';
import type {
  QueueClient,
  QueueDiagnosticsEntry,
  QueueMessage,
  QueuePollOptions,
  QueuePublishRequest,
  QueueWaitOptions
} from '@automation-platform/contracts';
import type { PlatformLogger } from '@automation-platform/contracts';
import { QueueOperationError, createCorrelationId, nowIso, waitFor } from '@automation-platform/utils';

const queueMessageSchema = z.object({
  id: z.string().min(1),
  queue: z.string().min(1),
  payload: z.unknown(),
  correlationId: z.string().optional(),
  headers: z.record(z.string()).optional(),
  createdAtIso: z.string().min(1)
});

export class InMemoryQueueClient implements QueueClient {
  private readonly queues = new Map<string, QueueMessage[]>();
  private readonly diagnostics: QueueDiagnosticsEntry[] = [];

  public constructor(private readonly logger: PlatformLogger) {}

  public async publish<TPayload>(
    request: QueuePublishRequest<TPayload>
  ): Promise<QueueMessage<TPayload>> {
    const message: QueueMessage<TPayload> = {
      id: `msg-${Date.now()}-${Math.round(Math.random() * 100000)}`,
      queue: request.queue,
      payload: request.payload,
      correlationId: request.correlationId ?? createCorrelationId(),
      headers: request.headers,
      createdAtIso: nowIso()
    };

    const validated = queueMessageSchema.parse(message);
    const queue = this.getQueue(request.queue);
    queue.push(validated as QueueMessage<TPayload>);

    this.diagnostics.push({
      queue: request.queue,
      messageId: message.id,
      correlationId: message.correlationId,
      observedAtIso: nowIso(),
      payloadPreview: JSON.stringify(request.payload).slice(0, 120)
    });

    this.logger.info('Queue publish completed', {
      queue: request.queue,
      messageId: message.id,
      correlationId: message.correlationId
    });

    return message;
  }

  public async poll<TPayload>(queueName: string, options: QueuePollOptions = {}): Promise<QueueMessage<TPayload>[]> {
    const queue = this.getQueue(queueName);
    const limit = options.limit ?? 10;
    const messages = queue.slice(0, limit);

    this.logger.debug('Queue poll completed', {
      queue: queueName,
      returned: messages.length,
      limit
    });

    return messages as QueueMessage<TPayload>[];
  }

  public async acknowledge(queueName: string, messageId: string): Promise<void> {
    const queue = this.getQueue(queueName);
    const index = queue.findIndex((message) => message.id === messageId);
    if (index >= 0) {
      queue.splice(index, 1);
    }

    this.logger.debug('Queue message acknowledged', {
      queue: queueName,
      messageId
    });
  }

  public async purge(queueName: string): Promise<void> {
    this.queues.set(queueName, []);
    this.logger.warn('Queue purged', { queue: queueName });
  }

  public diagnosticsEntries(): QueueDiagnosticsEntry[] {
    return [...this.diagnostics];
  }

  private getQueue(queueName: string): QueueMessage[] {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }
    return this.queues.get(queueName) as QueueMessage[];
  }
}

export class QueueWaiter {
  public constructor(
    private readonly client: QueueClient,
    private readonly logger: PlatformLogger
  ) {}

  public async waitForMessage<TPayload>(
    queue: string,
    matcher: (message: QueueMessage<TPayload>) => boolean,
    options: QueueWaitOptions
  ): Promise<QueueMessage<TPayload>> {
    return waitFor(
      async () => {
        const messages = await this.client.poll<TPayload>(queue, { limit: 100 });
        return messages.find((message) => matcher(message));
      },
      {
        timeoutMs: options.timeoutMs,
        pollingIntervalMs: options.pollingIntervalMs,
        description: `message in queue ${queue}`
      }
    );
  }

  public async waitForCorrelation<TPayload>(
    queue: string,
    correlationId: string,
    options: QueueWaitOptions
  ): Promise<QueueMessage<TPayload>> {
    this.logger.info('Queue wait started', {
      queue,
      correlationId,
      timeoutMs: options.timeoutMs
    });

    return this.waitForMessage(queue, (message) => message.correlationId === correlationId, options);
  }

  public async waitForProcessingCompletion<TStatus>(
    resolver: () => Promise<TStatus>,
    predicate: (status: TStatus) => boolean,
    options: QueueWaitOptions
  ): Promise<TStatus> {
    return waitFor(
      async () => {
        const status = await resolver();
        return predicate(status) ? status : undefined;
      },
      {
        timeoutMs: options.timeoutMs,
        pollingIntervalMs: options.pollingIntervalMs,
        description: 'queue processing completion'
      }
    );
  }

  public async waitForBackgroundJob(
    jobName: string,
    resolver: () => Promise<{ completed: boolean; state: string }>,
    options: QueueWaitOptions
  ): Promise<{ completed: boolean; state: string }> {
    return this.waitForProcessingCompletion(
      resolver,
      (status) => status.completed,
      options
    ).catch((error) => {
      throw new QueueOperationError(`Background job did not complete: ${jobName}`, {
        cause: error,
        metadata: {
          jobName
        }
      });
    });
  }
}

export interface DeadLetterQueueAdapter {
  moveToDeadLetter<TPayload>(queue: string, message: QueueMessage<TPayload>): Promise<void>;
  readDeadLetter<TPayload>(queue: string): Promise<QueueMessage<TPayload>[]>;
}

export class InMemoryDeadLetterQueueAdapter implements DeadLetterQueueAdapter {
  public constructor(private readonly client: InMemoryQueueClient) {}

  public async moveToDeadLetter<TPayload>(
    queue: string,
    message: QueueMessage<TPayload>
  ): Promise<void> {
    await this.client.publish({
      queue: `${queue}.dlq`,
      payload: message.payload,
      correlationId: message.correlationId,
      headers: {
        ...(message.headers ?? {}),
        originalQueue: queue,
        originalMessageId: message.id
      }
    });
  }

  public async readDeadLetter<TPayload>(queue: string): Promise<QueueMessage<TPayload>[]> {
    return this.client.poll<TPayload>(`${queue}.dlq`, { limit: 100 });
  }
}
