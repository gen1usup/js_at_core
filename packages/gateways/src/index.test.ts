import { describe, expect, it } from 'vitest';
import type {
  CleanupRegistry,
  DatabaseClient,
  ExecutionContext,
  HttpClient,
  HttpRequest,
  HttpResponse,
  PlatformLogger,
  QueueClient,
  ResourceRegistry
} from '@automation-platform/contracts';
import {
  TemplateApiRepository,
  TemplateDbRepository,
  type TemplateEntity
} from '@automation-platform/repositories';
import { InMemoryQueueClient } from '@automation-platform/queue-core';
import { TemplateEntityGateway } from './index';

const noopLogger: PlatformLogger = {
  child: () => noopLogger,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  fatal: () => undefined
};

const cleanup: CleanupRegistry = {
  add: () => undefined,
  runAll: async () => []
};

const resources: ResourceRegistry = {
  register: () => undefined,
  get: () => undefined,
  list: () => [],
  remove: () => undefined,
  clear: () => undefined
};

class FakeHttpClient implements HttpClient {
  private readonly entities = new Map<string, TemplateEntity>();

  public async send<TResponse, TBody = unknown>(
    request: HttpRequest<TBody>
  ): Promise<HttpResponse<TResponse>> {
    if (request.method === 'POST') {
      const id = `e-${Date.now()}`;
      const body = request.body as { name?: string; status?: TemplateEntity['status'] } | undefined;
      const entity: TemplateEntity = {
        id,
        name: body?.name ?? 'entity',
        status: body?.status ?? 'draft',
        createdAtIso: new Date().toISOString()
      };
      this.entities.set(id, entity);
      return {
        status: 201,
        headers: {},
        data: entity as TResponse,
        durationMs: 1
      };
    }

    const id = request.path.split('/').pop() as string;
    const current = this.entities.get(id);

    if (request.method === 'PUT' && current) {
      const body = request.body as { status?: TemplateEntity['status'] } | undefined;
      current.status = body?.status ?? current.status;
      this.entities.set(id, current);
    }

    return {
      status: current ? 200 : 404,
      headers: {},
      data: (current ?? null) as TResponse,
      durationMs: 1
    };
  }
}

class FakeDatabaseClient implements DatabaseClient {
  public async queryOne<T>(): Promise<T | null> {
    return null;
  }

  public async queryMany<T>(): Promise<T[]> {
    return [];
  }

  public async scalar<T>(): Promise<T | null> {
    return null;
  }

  public async exists(): Promise<boolean> {
    return false;
  }

  public async execute(): Promise<number> {
    return 0;
  }

  public async transaction<T>(action: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return action(this);
  }
}

describe('gateways', () => {
  it('orchestrates api and queue', async () => {
    const context: ExecutionContext = {
      executionId: 'exec-1',
      projectName: 'template',
      environment: 'test',
      startedAt: new Date(),
      correlationId: 'corr-1',
      capabilityMap: {
        queue: true
      },
      featureFlags: {},
      logger: noopLogger,
      resources,
      cleanup
    };

    const api = new TemplateApiRepository(new FakeHttpClient(), noopLogger);
    const db = new TemplateDbRepository(new FakeDatabaseClient(), noopLogger);
    const queue: QueueClient = new InMemoryQueueClient(noopLogger);

    const gateway = new TemplateEntityGateway(api, db, queue, context, noopLogger);
    const entity = await gateway.create({ name: 'X' });

    await queue.publish({
      queue: 'entity-events',
      payload: { id: entity.id },
      correlationId: context.correlationId
    });

    const activated = await gateway.activateAndWaitForBackgroundProcessing(
      {
        id: entity.id,
        status: 'active'
      },
      {
        queueName: 'entity-events',
        timeoutMs: 2_000
      }
    );

    expect(activated.status).toBe('active');
  });
});
