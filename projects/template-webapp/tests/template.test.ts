import { describe, expect, it } from 'vitest';
import type { ExecutionContext, HttpClient, HttpRequest, HttpResponse } from '@automation-platform/contracts';
import { createLogger } from '@automation-platform/logger';
import { InMemoryQueueClient } from '@automation-platform/queue-core';
import { TemplateWebApiRepository } from '../src/api-repository';
import { TemplateWebDbRepository } from '../src/db-repository';
import { TemplateWebGateway } from '../src/gateway';
import { runQueueAwareScenario } from '../src/async-scenario';

class FakeHttpClient implements HttpClient {
  private createdCount = 0;
  private status: 'draft' | 'active' | 'archived' = 'draft';

  public async send<TResponse, TBody = unknown>(request: HttpRequest<TBody>): Promise<HttpResponse<TResponse>> {
    if (request.method === 'POST') {
      this.createdCount += 1;
    }

    if (request.method === 'PUT') {
      const body = request.body as { status?: 'draft' | 'active' | 'archived' } | undefined;
      this.status = body?.status ?? this.status;
    }

    return {
      status: 200,
      headers: {},
      durationMs: 1,
      data: {
        id: `entity-${this.createdCount}`,
        name: 'Entity',
        status: this.status,
        createdAtIso: new Date().toISOString()
      } as TResponse
    };
  }
}

class FakeDbClient {
  public async queryOne() {
    return null;
  }
  public async queryMany() {
    return [];
  }
  public async scalar() {
    return null;
  }
  public async exists() {
    return false;
  }
  public async execute() {
    return 0;
  }
  public async transaction<T>(action: (client: FakeDbClient) => Promise<T>) {
    return action(this);
  }
}

describe('template-webapp', () => {
  it('runs queue aware scenario', async () => {
    const logger = createLogger({
      level: 'info',
      serviceName: 'test',
      environment: 'unit'
    });

    const context: ExecutionContext = {
      executionId: 'exec-template',
      projectName: 'template-webapp',
      environment: 'test',
      startedAt: new Date(),
      correlationId: 'corr-template',
      capabilityMap: {
        queue: true
      },
      featureFlags: {},
      logger,
      resources: {
        register: () => undefined,
        get: () => undefined,
        list: () => [],
        remove: () => undefined,
        clear: () => undefined
      },
      cleanup: {
        add: () => undefined,
        runAll: async () => []
      }
    };

    const apiRepository = new TemplateWebApiRepository(new FakeHttpClient(), logger);
    const dbRepository = new TemplateWebDbRepository(new FakeDbClient(), logger);
    const queueClient = new InMemoryQueueClient(logger);
    const gateway = new TemplateWebGateway(apiRepository, dbRepository, queueClient, context, logger);

    const result = await runQueueAwareScenario({
      gateway,
      queueClient,
      context,
      queueName: 'entity-events'
    });

    expect(result.entityId.length).toBeGreaterThan(0);
    expect(result.queueMessageId.length).toBeGreaterThan(0);
  });
});
