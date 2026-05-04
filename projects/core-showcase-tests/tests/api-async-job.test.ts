import { describe, expect, it } from 'vitest';
import {
  createDemoApiClient,
  createShowcaseLogger,
  createTask,
  hasDemoApp,
  loginUser,
  registerUser,
  startDemoWebApp,
  uniqueSuffix,
  waitForTaskStatus
} from './support/demo-app';

const maybeIt = hasDemoApp ? it : it.skip;

describe('API async job showcase against demo-web-app', () => {
  maybeIt('creates a queued task and polls until the worker marks it completed', async () => {
    const demoApp = await startDemoWebApp('demo-api-async-job-data');

    try {
      let accessToken: string | undefined;
      const apiClient = createDemoApiClient({
        baseUrl: demoApp.baseUrl,
        logger: createShowcaseLogger('api-async-job-showcase-test'),
        getAccessToken: () => accessToken
      });

      const unique = uniqueSuffix();
      const username = `async-user-${unique}`;
      const password = 'StrongPass!1234';

      await registerUser(apiClient, username, password);
      const loggedIn = await loginUser(apiClient, username, password);
      accessToken = loggedIn.data.token;

      const createdTask = await createTask(apiClient, `async task ${unique}`);
      expect(createdTask.data.task.status).toBe('queued');

      const completedTask = await waitForTaskStatus(
        apiClient,
        createdTask.data.task.id,
        'completed'
      );
      expect(completedTask.data.task.status).toBe('completed');
    } finally {
      await demoApp.stopAndCleanup();
    }
  });
});
