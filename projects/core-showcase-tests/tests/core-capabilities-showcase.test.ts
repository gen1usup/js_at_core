import fs from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  DatabaseClient,
  DbQueryOptions,
  HttpClient,
  HttpRequest,
  HttpResponse,
  ResolvedSelector,
  UIActionOptions,
  UIDriver,
  UIWaitOptions
} from '@automation-platform/contracts';
import { loadPlatformConfig } from '@automation-platform/config';
import { createFailureBundle } from '@automation-platform/diagnostics';
import {
  DeterministicDataGenerator,
  LifecycleEntitySupport,
  PresetFactory,
  createSnapshotDiff,
  templateEntityBuilder
} from '@automation-platform/data-support';
import { createExecutionContext, runWithCleanup, StepRunner } from '@automation-platform/execution';
import { TemplateEntityGateway } from '@automation-platform/gateways';
import { createLogger } from '@automation-platform/logger';
import { defineMetadata, metadataSupportsCapabilities } from '@automation-platform/metadata';
import { DiagnosticsReportPlugin, PluginManager } from '@automation-platform/plugins';
import {
  InMemoryDeadLetterQueueAdapter,
  InMemoryQueueClient
} from '@automation-platform/queue-core';
import {
  TemplateApiRepository,
  TemplateDbRepository,
  type TemplateEntity
} from '@automation-platform/repositories';
import { NamespacedSelectorRegistry, SelectorBuilder } from '@automation-platform/selectors';
import { UICore } from '@automation-platform/ui-core';
import { ComponentFactory } from '@automation-platform/ui-components';

class FakeHttpClient implements HttpClient {
  private readonly entities = new Map<string, TemplateEntity>();
  private sequence = 0;
  private readonly reads = new Map<string, number>();

  public async send<TResponse, TBody = unknown>(
    request: HttpRequest<TBody>
  ): Promise<HttpResponse<TResponse>> {
    if (request.path === '/auth/login' && request.method === 'POST') {
      return {
        status: 200,
        headers: {},
        durationMs: 1,
        data: {
          token: 'token-showcase',
          expiresAtIso: new Date(Date.now() + 60_000).toISOString()
        } as TResponse
      };
    }

    if (request.path === '/entities' && request.method === 'POST') {
      this.sequence += 1;
      const id = `entity-${this.sequence}`;
      const body = request.body as { name?: string; status?: TemplateEntity['status'] } | undefined;
      const entity: TemplateEntity = {
        id,
        name: body?.name ?? `entity-${this.sequence}`,
        status: body?.status ?? 'draft',
        createdAtIso: new Date().toISOString()
      };
      this.entities.set(id, entity);
      return {
        status: 201,
        headers: {},
        durationMs: 1,
        data: entity as TResponse
      };
    }

    const id = request.path.split('/').pop() as string;
    const current = this.entities.get(id);

    if (!current) {
      return {
        status: 404,
        headers: {},
        durationMs: 1,
        data: null as TResponse
      };
    }

    if (request.method === 'PUT') {
      const body = request.body as { status?: TemplateEntity['status'] } | undefined;
      current.status = body?.status ?? current.status;
      this.entities.set(id, current);
    }

    if (request.method === 'GET' && current.status === 'draft') {
      const readCount = (this.reads.get(id) ?? 0) + 1;
      this.reads.set(id, readCount);
      if (readCount >= 2) {
        current.status = 'active';
        this.entities.set(id, current);
      }
    }

    if (request.method === 'DELETE') {
      this.entities.delete(id);
      return {
        status: 204,
        headers: {},
        durationMs: 1,
        data: null as TResponse
      };
    }

    return {
      status: 200,
      headers: {},
      durationMs: 1,
      data: current as TResponse
    };
  }
}

class FakeDatabaseClient implements DatabaseClient {
  private readonly entities = new Map<string, TemplateEntity>();

  public async queryOne<T>(
    sql: string,
    params: readonly unknown[],
    mapper?: (row: unknown) => T
  ): Promise<T | null> {
    if (!sql.toLowerCase().includes('template_entities')) {
      return null;
    }

    const entity = this.entities.get(String(params[0] ?? ''));
    if (!entity) {
      return null;
    }

    const row = {
      id: entity.id,
      name: entity.name,
      status: entity.status,
      created_at_iso: entity.createdAtIso
    };

    return mapper ? mapper(row) : (row as T);
  }

  public async queryMany<T>(): Promise<T[]> {
    return [];
  }

  public async scalar<T>(): Promise<T | null> {
    return null;
  }

  public async exists(sql: string, params: readonly unknown[]): Promise<boolean> {
    if (!sql.toLowerCase().includes('template_entities')) {
      return false;
    }

    return this.entities.has(String(params[0] ?? ''));
  }

  public async execute(
    sql: string,
    params: readonly unknown[],
    _options?: DbQueryOptions
  ): Promise<number> {
    const normalized = sql.toLowerCase();

    if (normalized.includes('insert into template_entities')) {
      const entity: TemplateEntity = {
        id: String(params[0] ?? ''),
        name: String(params[1] ?? ''),
        status: (params[2] as TemplateEntity['status']) ?? 'draft',
        createdAtIso: String(params[3] ?? new Date().toISOString())
      };
      this.entities.set(entity.id, entity);
      return 1;
    }

    if (normalized.includes('delete from template_entities')) {
      return this.entities.delete(String(params[0] ?? '')) ? 1 : 0;
    }

    return 0;
  }

  public async transaction<T>(action: (client: DatabaseClient) => Promise<T>): Promise<T> {
    return action(this);
  }
}

class FakeUiDriver implements UIDriver {
  public readonly values = new Map<string, string>();
  public readonly clicked: string[] = [];

  public async goto(): Promise<void> {
    return;
  }
  public async close(): Promise<void> {
    return;
  }
  public async currentUrl(): Promise<string> {
    return 'http://fake-ui.local';
  }
  public async screenshot(): Promise<void> {
    return;
  }
  public async click(selector: ResolvedSelector): Promise<void> {
    this.clicked.push(`${selector.namespace}.${selector.key}`);
  }
  public async doubleClick(): Promise<void> {
    return;
  }
  public async hover(): Promise<void> {
    return;
  }
  public async fill(selector: ResolvedSelector, value: string): Promise<void> {
    this.values.set(`${selector.namespace}.${selector.key}`, value);
  }
  public async type(selector: ResolvedSelector, value: string): Promise<void> {
    const key = `${selector.namespace}.${selector.key}`;
    const current = this.values.get(key) ?? '';
    this.values.set(key, `${current}${value}`);
  }
  public async clear(selector: ResolvedSelector): Promise<void> {
    this.values.set(`${selector.namespace}.${selector.key}`, '');
  }
  public async press(
    _selector: ResolvedSelector,
    _key: string,
    _options?: UIActionOptions
  ): Promise<void> {
    return;
  }
  public async select(selector: ResolvedSelector, value: string | string[]): Promise<void> {
    this.values.set(
      `${selector.namespace}.${selector.key}`,
      Array.isArray(value) ? value.join(',') : value
    );
  }
  public async check(selector: ResolvedSelector): Promise<void> {
    this.values.set(`${selector.namespace}.${selector.key}.checked`, 'true');
  }
  public async uncheck(selector: ResolvedSelector): Promise<void> {
    this.values.delete(`${selector.namespace}.${selector.key}.checked`);
  }
  public async upload(selector: ResolvedSelector, filePath: string): Promise<void> {
    this.values.set(`${selector.namespace}.${selector.key}.file`, filePath);
  }

  public async text(selector: ResolvedSelector): Promise<string> {
    return this.values.get(`${selector.namespace}.${selector.key}`) ?? '';
  }

  public async value(selector: ResolvedSelector): Promise<string> {
    return this.values.get(`${selector.namespace}.${selector.key}`) ?? '';
  }

  public async attribute(selector: ResolvedSelector, attribute: string): Promise<string | null> {
    if (attribute !== 'checked') {
      return null;
    }
    return this.values.get(`${selector.namespace}.${selector.key}.checked`) ?? null;
  }

  public async waitForVisible(
    _selector: ResolvedSelector,
    _options?: UIWaitOptions
  ): Promise<void> {
    return;
  }

  public async waitForHidden(_selector: ResolvedSelector, _options?: UIWaitOptions): Promise<void> {
    return;
  }

  public async waitForExists(_selector: ResolvedSelector, _options?: UIWaitOptions): Promise<void> {
    return;
  }

  public async evaluate<TOutput>(expression: () => TOutput): Promise<TOutput> {
    return expression();
  }
}

const cleanupPaths: string[] = [];

afterEach(async () => {
  for (const currentPath of cleanupPaths.splice(0)) {
    await fs.rm(currentPath, { recursive: true, force: true });
  }
});

describe('core capabilities showcase', () => {
  it('demonstrates core API/DB/queue/diagnostics modules with a contract-only UI driver', async () => {
    const config = loadPlatformConfig({
      env: {
        AP_BASE_URL: 'http://mock.local',
        AP_API_ENABLED: 'true',
        AP_QUEUE_ENABLED: 'true',
        AP_DB_ENABLED: 'true',
        AP_PROJECT_NAME: 'core-showcase'
      }
    });

    const logger = createLogger({
      level: 'info',
      serviceName: 'core-showcase-test',
      environment: 'test'
    });

    const metadata = defineMetadata({
      testId: 'core-showcase-001',
      title: 'Core showcase',
      feature: 'platform-core',
      component: 'integration',
      severity: 'high',
      risk: 'major',
      businessCriticality: 'p1',
      owner: 'platform-team',
      tags: ['core', 'showcase', 'mock'],
      estimatedDurationMs: 30_000,
      suite: 'regression',
      capabilityRequirements: ['api', 'queue', 'db', 'diagnostics', 'plugins', 'cleanup']
    });

    expect(metadataSupportsCapabilities(metadata, config.capabilities).supported).toBe(true);

    const context = createExecutionContext({
      projectName: config.projectName,
      environment: config.environment,
      capabilityMap: config.capabilities,
      featureFlags: config.featureFlags,
      logger,
      metadata
    });

    const stepRunner = new StepRunner(context);

    const apiRepository = new TemplateApiRepository(new FakeHttpClient(), context.logger);
    const dbRepository = new TemplateDbRepository(new FakeDatabaseClient(), context.logger);
    const queueClient = new InMemoryQueueClient(context.logger);

    const gateway = new TemplateEntityGateway(
      apiRepository,
      dbRepository,
      queueClient,
      context,
      context.logger
    );

    const created = await stepRunner.run('gateway.create', async () =>
      gateway.create({
        name: 'showcase-entity',
        cleanupViaApi: true
      })
    );

    expect(created.data?.status).toBe('draft');

    const eventuallyActive = await apiRepository.waitUntilStatus(created.data?.id ?? '', 'active', {
      timeoutMs: 2_000,
      pollingIntervalMs: 50
    });
    expect(eventuallyActive.status).toBe('active');

    await queueClient.publish({
      queue: 'entity-events',
      payload: {
        entityId: eventuallyActive.id
      },
      correlationId: context.correlationId
    });

    const archived = await gateway.activateAndWaitForBackgroundProcessing(
      {
        id: eventuallyActive.id,
        status: 'archived'
      },
      {
        queueName: 'entity-events',
        timeoutMs: 2_000
      }
    );
    expect(archived.status).toBe('archived');

    const dbEntity = await dbRepository.createMinimalValid('db-showcase');
    expect(await dbRepository.existsById(dbEntity.id)).toBe(true);

    const dlqAdapter = new InMemoryDeadLetterQueueAdapter(queueClient);
    const published = await queueClient.publish({
      queue: 'jobs',
      payload: {
        jobId: 'job-1'
      },
      correlationId: 'corr-job-1'
    });
    await dlqAdapter.moveToDeadLetter('jobs', published);
    const dlqMessages = await dlqAdapter.readDeadLetter<{ jobId: string }>('jobs');
    expect(dlqMessages[0]?.payload.jobId).toBe('job-1');

    const selectors = new NamespacedSelectorRegistry([
      new SelectorBuilder('demo', 'username').withTestId('username').withCss('#username').build(),
      new SelectorBuilder('demo', 'submit').withTestId('submit').withCss('#submit').build()
    ]);

    const uiDriver = new FakeUiDriver();
    const uiCore = new UICore({
      driver: uiDriver,
      selectors,
      logger: context.logger
    });

    const components = new ComponentFactory({
      ui: uiCore,
      logger: context.logger,
      namespace: 'demo'
    });

    await components.input('username').setValue('platform-user');
    await components.button('submit').click();

    expect(uiDriver.values.get('demo.username')).toBe('platform-user');
    expect(uiDriver.clicked).toContain('demo.submit');

    const generator = new DeterministicDataGenerator(2026);
    const built = templateEntityBuilder(generator).build();

    const presets = new PresetFactory<{ type: string; enabled: boolean }>();
    presets.register('base', {
      type: 'demo',
      enabled: true
    });

    const overridden = presets.create('base', {
      enabled: false
    });

    expect(overridden.enabled).toBe(false);

    const diff = createSnapshotDiff(
      {
        status: built.status,
        name: built.name
      },
      {
        status: 'active',
        name: built.name
      }
    );

    expect(Object.keys(diff.diff)).toContain('status');

    let lifecycleCleaned = false;
    await runWithCleanup(context, async (ctx) => {
      LifecycleEntitySupport.fromContext(ctx).registerEntity({
        id: 'resource-1',
        type: 'showcase',
        payload: {
          source: 'test'
        },
        cleanup: async () => {
          lifecycleCleaned = true;
        }
      });
    });

    expect(lifecycleCleaned).toBe(true);

    const bundle = await createFailureBundle({
      context,
      stepName: 'showcase.step',
      error: new Error('forced showcase failure'),
      apiTraces: [
        {
          request: {
            method: 'POST',
            url: '/entities',
            status: 201,
            durationMs: 10,
            correlationId: context.correlationId
          },
          timestampIso: new Date().toISOString()
        }
      ]
    });

    expect(bundle.summary.failedStep).toBe('showcase.step');

    const pluginOutputDir = path.resolve('artifacts', 'plugins', 'core-showcase');
    cleanupPaths.push(path.resolve('artifacts', 'diagnostics', context.executionId));
    cleanupPaths.push(pluginOutputDir);

    const pluginManager = new PluginManager(context.logger);
    pluginManager.register(
      new DiagnosticsReportPlugin({
        outputDir: pluginOutputDir
      })
    );

    await pluginManager.runHook('onDiagnostics', context, {
      executionId: context.executionId,
      diagnostics: bundle
    });

    const reportPath = path.resolve(pluginOutputDir, `diagnostics-${context.executionId}.json`);
    const reportRaw = await fs.readFile(reportPath, 'utf8');
    expect(reportRaw).toContain(context.executionId);
  });
});
