import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AxiosHttpClient } from '@automation-platform/api-core';
import { loadPlatformConfig } from '@automation-platform/config';
import { createFailureBundle } from '@automation-platform/diagnostics';
import { createExecutionContext, runWithCleanup, StepRunner } from '@automation-platform/execution';
import { createLogger } from '@automation-platform/logger';
import { defineMetadata, metadataSupportsCapabilities } from '@automation-platform/metadata';
import { DiagnosticsReportPlugin, PluginManager } from '@automation-platform/plugins';

interface DemoWebAppInstance {
  start(): Promise<{ host: string; port: number; baseUrl: string }>;
  stop(): Promise<void>;
}

interface DemoConfigInput {
  host?: string;
  port?: number;
  dataDir?: string;
  queueName?: string;
  tokenTtlMs?: number;
  workerPollMs?: number;
}

interface DemoAppModule {
  createDemoWebApp(input?: Partial<DemoConfigInput>): DemoWebAppInstance;
}

const demoAppEntryPath = path.resolve(process.cwd(), 'demo-web-app/src/app.ts');
const hasDemoApp = existsSync(demoAppEntryPath);
const maybeIt = hasDemoApp ? it : it.skip;

const userSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  roles: z.array(z.string().min(1))
});

const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  correlationId: z.string().min(1),
  createdAtIso: z.string().min(1),
  updatedAtIso: z.string().min(1),
  lastError: z.string().optional()
});

const envelope = <TData extends z.ZodTypeAny>(dataSchema: TData) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema
  });

const registerSchema = envelope(
  z.object({
    user: userSchema
  })
);

const loginSchema = envelope(
  z.object({
    token: z.string().min(1),
    expiresAtIso: z.string().min(1),
    user: userSchema
  })
);

const meSchema = envelope(
  z.object({
    user: userSchema
  })
);

const taskEnvelopeSchema = envelope(
  z.object({
    task: taskSchema
  })
);

const taskListSchema = envelope(
  z.object({
    items: z.array(taskSchema)
  })
);

const dlqSchema = envelope(
  z.object({
    queue: z.string().min(1),
    failedTasks: z.array(taskSchema)
  })
);

describe('core real integration with demo-web-app', () => {
  maybeIt('runs end-to-end flow against real demo API/DB/queue and persists diagnostics plugin report', async () => {
    const demoDataDir = path.resolve('artifacts', 'demo-real-integration-data', `${Date.now()}`);

    const imported = (await import(demoAppEntryPath)) as DemoAppModule;
    const demoApp = imported.createDemoWebApp({
      port: 0,
      dataDir: demoDataDir,
      workerPollMs: 30
    });

    const started = await demoApp.start();

    const config = loadPlatformConfig({
      env: {
        AP_BASE_URL: started.baseUrl,
        AP_PROJECT_NAME: 'core-real-demo',
        AP_API_ENABLED: 'true',
        AP_QUEUE_ENABLED: 'true',
        AP_DB_ENABLED: 'true',
        AP_DIAGNOSTICS_ENABLED: 'true'
      },
      project: {
        projectName: 'core-real-demo',
        capabilities: {
          ui: true,
          api: true,
          db: true,
          queue: true,
          screenshots: false,
          networkCapture: false,
          consoleCapture: false,
          fileUpload: true,
          downloadHandling: false,
          multiTab: false,
          authViaApi: true,
          authViaUi: false,
          diagnostics: true,
          cleanup: true,
          plugins: true
        }
      }
    });

    const logger = createLogger({
      level: 'info',
      serviceName: 'core-real-demo-test',
      environment: 'test'
    });

    const metadata = defineMetadata({
      testId: 'core-real-demo-001',
      title: 'Real integration test for demo web app',
      feature: 'core-real-integration',
      component: 'integration',
      severity: 'high',
      risk: 'major',
      businessCriticality: 'p1',
      owner: 'platform-team',
      tags: ['real', 'demo', 'api', 'queue', 'db'],
      estimatedDurationMs: 120_000,
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

    let accessToken: string | undefined;

    const apiClient = new AxiosHttpClient({
      baseUrl: config.api.baseUrl,
      timeoutMs: config.api.timeoutMs,
      retry: config.api.retry,
      logger: context.logger,
      authTokenProvider: async () => accessToken,
      defaultHeaders: {
        'x-core-real-integration': 'true'
      }
    });

    const stepRunner = new StepRunner(context);

    const pluginOutputDir = path.resolve('artifacts', 'plugins', 'core-real-demo');
    const pluginManager = new PluginManager(context.logger);
    pluginManager.register(
      new DiagnosticsReportPlugin({
        outputDir: pluginOutputDir
      })
    );

    let appStopped = false;

    context.cleanup.add({
      id: 'demo.stop',
      description: 'Stop demo web app',
      critical: true,
      run: async () => {
        if (!appStopped) {
          await demoApp.stop();
          appStopped = true;
        }
      }
    });

    context.cleanup.add({
      id: 'demo.data.cleanup',
      description: 'Remove demo test data',
      run: async () => {
        await fs.rm(demoDataDir, { recursive: true, force: true });
      }
    });

    context.cleanup.add({
      id: 'demo.plugin.cleanup',
      description: 'Remove plugin artifacts',
      run: async () => {
        await fs.rm(pluginOutputDir, { recursive: true, force: true });
      }
    });

    context.cleanup.add({
      id: 'demo.diagnostics.cleanup',
      description: 'Remove diagnostics artifacts for execution',
      run: async () => {
        const diagnosticsPath = path.resolve('artifacts', 'diagnostics', context.executionId);
        await fs.rm(diagnosticsPath, { recursive: true, force: true });
      }
    });

    await runWithCleanup(context, async () => {
      const unique = Date.now().toString(16);
      const username = `real-user-${unique}`;
      const password = 'StrongPass!1234';

      const registerResult = await stepRunner.run('demo.register', async () =>
        apiClient.request({
          request: {
            method: 'POST',
            path: '/api/auth/register',
            body: {
              username,
              password
            }
          },
          responseSchema: registerSchema
        })
      );

      expect(registerResult.data?.data.user.username).toBe(username);

      const loginResult = await stepRunner.run('demo.login', async () =>
        apiClient.request({
          request: {
            method: 'POST',
            path: '/api/auth/login',
            body: {
              username,
              password
            }
          },
          responseSchema: loginSchema
        })
      );

      accessToken = loginResult.data?.data.token;
      expect(typeof accessToken).toBe('string');

      const me = await apiClient.request({
        request: {
          method: 'GET',
          path: '/api/auth/me'
        },
        responseSchema: meSchema
      });

      expect(me.data.user.id).toBe(loginResult.data?.data.user.id);

      const createdTask = await apiClient.request({
        request: {
          method: 'POST',
          path: '/api/tasks',
          body: {
            title: 'real integration task'
          },
          headers: {
            'x-correlation-id': context.correlationId
          }
        },
        responseSchema: taskEnvelopeSchema
      });

      const completedTaskPayload = await apiClient.poll<z.infer<typeof taskEnvelopeSchema>>(
        () => ({
          method: 'GET',
          path: `/api/tasks/${createdTask.data.task.id}`
        }),
        (payload) => payload.data.task.status === 'completed',
        {
          timeoutMs: 10_000,
          pollingIntervalMs: 120,
          responseSchema: taskEnvelopeSchema
        }
      );

      expect(completedTaskPayload.data.task.status).toBe('completed');

      const failedTask = await apiClient.request({
        request: {
          method: 'POST',
          path: '/api/tasks',
          body: {
            title: '[fail] integration forced failure'
          }
        },
        responseSchema: taskEnvelopeSchema
      });

      const failedTaskPayload = await apiClient.poll<z.infer<typeof taskEnvelopeSchema>>(
        () => ({
          method: 'GET',
          path: `/api/tasks/${failedTask.data.task.id}`
        }),
        (payload) => payload.data.task.status === 'failed',
        {
          timeoutMs: 10_000,
          pollingIntervalMs: 120,
          responseSchema: taskEnvelopeSchema
        }
      );

      expect(failedTaskPayload.data.task.status).toBe('failed');
      expect(typeof failedTaskPayload.data.task.lastError).toBe('string');

      const dlq = await apiClient.request({
        request: {
          method: 'GET',
          path: '/api/queue/dlq'
        },
        responseSchema: dlqSchema
      });

      expect(dlq.data.failedTasks.some((task) => task.id === failedTask.data.task.id)).toBe(true);

      const taskList = await apiClient.request({
        request: {
          method: 'GET',
          path: '/api/tasks'
        },
        responseSchema: taskListSchema
      });

      expect(taskList.data.items.length).toBeGreaterThanOrEqual(2);

      const htmlResponse = await apiClient.send<string>({
        method: 'GET',
        path: '/'
      });

      expect(htmlResponse.status).toBe(200);
      expect(htmlResponse.data.includes('Demo Web App')).toBe(true);
      expect(htmlResponse.data.includes('create-task')).toBe(true);

      const healthResponse = await apiClient.send<{ ok: boolean }>({
        method: 'GET',
        path: '/health'
      });
      expect(healthResponse.data.ok).toBe(true);

      const authDbPath = path.resolve(demoDataDir, 'auth-db.json');
      const appDbPath = path.resolve(demoDataDir, 'app-db.json');

      const authDbRaw = await fs.readFile(authDbPath, 'utf8');
      const appDbRaw = await fs.readFile(appDbPath, 'utf8');

      expect(authDbRaw.includes(username)).toBe(true);
      expect(appDbRaw.includes(createdTask.data.task.id)).toBe(true);
      expect(appDbRaw.includes(failedTask.data.task.id)).toBe(true);

      const diagnosticsBundle = await createFailureBundle({
        context,
        stepName: 'real.integration.demo.failure.snapshot',
        error: new Error('captured for artifact verification'),
        apiTraces: [
          {
            request: {
              method: 'POST',
              url: '/api/tasks',
              status: 202,
              durationMs: 15,
              correlationId: context.correlationId
            },
            timestampIso: new Date().toISOString()
          }
        ]
      });

      await pluginManager.runHook('onDiagnostics', context, {
        executionId: context.executionId,
        diagnostics: diagnosticsBundle
      });

      const reportPath = path.resolve(pluginOutputDir, `diagnostics-${context.executionId}.json`);
      const reportRaw = await fs.readFile(reportPath, 'utf8');
      expect(reportRaw.includes(context.executionId)).toBe(true);
    });

    expect(appStopped).toBe(true);
  });
});
