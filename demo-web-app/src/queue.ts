import { randomUUID } from 'node:crypto';
import type { Logger } from './logger';
import type { QueueMessage, TaskQueuePayload } from './types';

const nowIso = (): string => new Date().toISOString();

export class InMemoryQueue {
  private readonly queues = new Map<string, QueueMessage<unknown>[]>();

  public publish<TPayload>(request: {
    queue: string;
    payload: TPayload;
    correlationId: string;
  }): QueueMessage<TPayload> {
    const message: QueueMessage<TPayload> = {
      id: randomUUID(),
      queue: request.queue,
      payload: request.payload,
      correlationId: request.correlationId,
      createdAtIso: nowIso()
    };

    const queue = this.getQueue(request.queue);
    queue.push(message as QueueMessage<unknown>);

    return message;
  }

  public poll<TPayload>(queueName: string, limit = 10): QueueMessage<TPayload>[] {
    const queue = this.getQueue(queueName);
    const output = queue.slice(0, limit);
    return output as QueueMessage<TPayload>[];
  }

  public acknowledge(queueName: string, messageId: string): void {
    const queue = this.getQueue(queueName);
    const index = queue.findIndex((message) => message.id === messageId);
    if (index >= 0) {
      queue.splice(index, 1);
    }
  }

  public size(queueName: string): number {
    return this.getQueue(queueName).length;
  }

  private getQueue(queueName: string): QueueMessage<unknown>[] {
    if (!this.queues.has(queueName)) {
      this.queues.set(queueName, []);
    }

    return this.queues.get(queueName) as QueueMessage<unknown>[];
  }
}

export interface TaskWorkerOptions {
  queueName: string;
  pollIntervalMs: number;
}

export interface TaskWorkerDeps {
  queue: InMemoryQueue;
  database: {
    getTaskById(taskId: string): Promise<{ id: string; title: string } | null>;
    updateTaskStatus(
      taskId: string,
      status: 'processing' | 'completed' | 'failed',
      lastError?: string
    ): Promise<unknown>;
  };
  logger: Logger;
  options: TaskWorkerOptions;
}

export class TaskWorker {
  private timer: NodeJS.Timeout | undefined;
  private busy = false;

  public constructor(private readonly deps: TaskWorkerDeps) {}

  public start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.tick();
    }, this.deps.options.pollIntervalMs);
  }

  public async stop(): Promise<void> {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = undefined;
  }

  private async tick(): Promise<void> {
    if (this.busy) {
      return;
    }

    this.busy = true;

    try {
      const messages = this.deps.queue.poll<TaskQueuePayload>(this.deps.options.queueName, 20);

      for (const message of messages) {
        await this.processMessage(message);
      }
    } finally {
      this.busy = false;
    }
  }

  private async processMessage(message: QueueMessage<TaskQueuePayload>): Promise<void> {
    const payload = message.payload;

    try {
      const task = await this.deps.database.getTaskById(payload.taskId);

      if (!task) {
        this.deps.logger.warn('Task not found for queue message', {
          taskId: payload.taskId,
          messageId: message.id
        });
        this.deps.queue.acknowledge(this.deps.options.queueName, message.id);
        return;
      }

      await this.deps.database.updateTaskStatus(task.id, 'processing');

      if (task.title.toLowerCase().includes('[fail]')) {
        throw new Error('Task was forced to fail by title marker');
      }

      await this.deps.database.updateTaskStatus(task.id, 'completed');
      this.deps.queue.acknowledge(this.deps.options.queueName, message.id);

      this.deps.logger.info('Task completed by worker', {
        taskId: task.id,
        messageId: message.id,
        correlationId: message.correlationId
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown worker error';

      await this.deps.database.updateTaskStatus(payload.taskId, 'failed', errorMessage);

      this.deps.queue.publish({
        queue: `${this.deps.options.queueName}.dlq`,
        payload,
        correlationId: message.correlationId
      });
      this.deps.queue.acknowledge(this.deps.options.queueName, message.id);

      this.deps.logger.error('Task failed and moved to DLQ', {
        taskId: payload.taskId,
        messageId: message.id,
        error: errorMessage
      });
    }
  }
}
