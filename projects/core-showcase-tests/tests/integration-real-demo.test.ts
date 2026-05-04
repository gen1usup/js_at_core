import fs from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPlatformConfig } from '@automation-platform/config';
import { createExecutionContext, runWithCleanup, StepRunner } from '@automation-platform/execution';
import { defineMetadata, metadataSupportsCapabilities } from '@automation-platform/metadata';
import {
  createDemoApiClient,
  createShowcaseLogger,
  createTask,
  hasDemoApp,
  listTasks,
  loginUser,
  registerUser,
  startDemoWebApp,
  uniqueSuffix,
  waitForTaskStatus
} from './support/demo-app';

const maybeIt = hasDemoApp ? it : it.skip;

const requireStepData = <T>(data: T | undefined, stepName: string): T => {
  expect(data, `${stepName} should return step data`).toBeDefined();
  if (data === undefined) {
    throw new Error(`${stepName} did not return step data`);
  }

  return data;
};

describe('real demo app integration showcase', () => {
  maybeIt(
    'combines config, metadata, execution context, API client and cleanup without browser runtime',
    async () => {
      const demoApp = await startDemoWebApp('demo-real-integration-data');
      let cleanupHandledByContext = false;

      try {
        const config = loadPlatformConfig({
          env: {
            AP_BASE_URL: demoApp.baseUrl,
            AP_PROJECT_NAME: 'core-real-demo',
            AP_API_ENABLED: 'true',
            AP_QUEUE_ENABLED: 'true',
            AP_DB_ENABLED: 'true',
            AP_DIAGNOSTICS_ENABLED: 'true'
          },
          project: {
            projectName: 'core-real-demo',
            capabilities: {
              ui: false,
              api: true,
              db: true,
              queue: true,
              screenshots: false,
              networkCapture: false,
              consoleCapture: false,
              fileUpload: false,
              downloadHandling: false,
              multiTab: false,
              authViaApi: true,
              authViaUi: false,
              diagnostics: true,
              cleanup: true,
              plugins: false
            }
          }
        });

        const metadata = defineMetadata({
          testId: 'core-real-demo-001',
          title: 'Real API, file DB, queue and cleanup integration against demo web app',
          feature: 'core-real-integration',
          component: 'demo-web-app',
          severity: 'high',
          risk: 'major',
          businessCriticality: 'p1',
          owner: 'platform-team',
          tags: ['real', 'demo', 'api', 'queue', 'db', 'cleanup', 'no-browser'],
          estimatedDurationMs: 120_000,
          suite: 'regression',
          capabilityRequirements: ['api', 'queue', 'db', 'diagnostics', 'cleanup']
        });

        expect(metadataSupportsCapabilities(metadata, config.capabilities).supported).toBe(true);

        const logger = createShowcaseLogger('core-real-demo-test');
        const context = createExecutionContext({
          projectName: config.projectName,
          environment: config.environment,
          capabilityMap: config.capabilities,
          featureFlags: config.featureFlags,
          logger,
          metadata
        });

        context.cleanup.add({
          id: 'demo-web-app.cleanup',
          description: 'Stop demo web app and remove temporary file DB',
          critical: true,
          run: async () => {
            await demoApp.stopAndCleanup();
            cleanupHandledByContext = true;
          }
        });

        let accessToken: string | undefined;
        const apiClient = createDemoApiClient({
          baseUrl: config.api.baseUrl,
          logger: context.logger,
          getAccessToken: () => accessToken
        });
        const stepRunner = new StepRunner(context);

        await runWithCleanup(context, async () => {
          const unique = uniqueSuffix();
          const username = `real-user-${unique}`;
          const password = 'StrongPass!1234';

          const registerResult = await stepRunner.run('demo.register', () =>
            registerUser(apiClient, username, password)
          );
          const registered = requireStepData(registerResult.data, 'demo.register');
          expect(registered.data.user.username).toBe(username);

          const loginResult = await stepRunner.run('demo.login', () =>
            loginUser(apiClient, username, password)
          );
          const loggedIn = requireStepData(loginResult.data, 'demo.login');
          accessToken = loggedIn.data.token;
          expect(accessToken.length).toBeGreaterThan(20);

          const createdTask = await stepRunner.run('demo.create-task', () =>
            createTask(apiClient, `real integration task ${unique}`, context.correlationId)
          );
          const taskCreated = requireStepData(createdTask.data, 'demo.create-task');
          expect(taskCreated.data.task.correlationId).toBe(context.correlationId);

          const completedTask = await stepRunner.run('demo.wait-completed-task', () =>
            waitForTaskStatus(apiClient, taskCreated.data.task.id, 'completed')
          );
          const taskCompleted = requireStepData(completedTask.data, 'demo.wait-completed-task');
          expect(taskCompleted.data.task.status).toBe('completed');

          const taskList = await listTasks(apiClient);
          expect(taskList.data.items.some((task) => task.id === taskCreated.data.task.id)).toBe(
            true
          );

          const htmlResponse = await apiClient.send<string>({
            method: 'GET',
            path: '/'
          });
          expect(htmlResponse.status).toBe(200);
          expect(htmlResponse.data).toContain('Demo Web App');

          const authDbRaw = await fs.readFile(
            path.resolve(demoApp.dataDir, 'auth-db.json'),
            'utf8'
          );
          const appDbRaw = await fs.readFile(path.resolve(demoApp.dataDir, 'app-db.json'), 'utf8');

          expect(authDbRaw).toContain(username);
          expect(appDbRaw).toContain(taskCreated.data.task.id);
        });

        expect(cleanupHandledByContext).toBe(true);
      } finally {
        if (!cleanupHandledByContext) {
          await demoApp.stopAndCleanup();
        }
      }
    }
  );
});
