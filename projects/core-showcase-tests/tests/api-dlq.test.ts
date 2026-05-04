import { describe, expect, it } from 'vitest';
import {
  createDemoApiClient,
  createShowcaseLogger,
  createTask,
  hasDemoApp,
  loginUser,
  readDeadLetterQueue,
  registerUser,
  startDemoWebApp,
  uniqueSuffix,
  waitForTaskStatus
} from './support/demo-app';

const maybeIt = hasDemoApp ? it : it.skip;

describe('API DLQ showcase against demo-web-app', () => {
  maybeIt('forces a task failure, polls failed status, and verifies DLQ visibility', async () => {
    const demoApp = await startDemoWebApp('demo-api-dlq-data');

    try {
      let accessToken: string | undefined;
      const apiClient = createDemoApiClient({
        baseUrl: demoApp.baseUrl,
        logger: createShowcaseLogger('api-dlq-showcase-test'),
        getAccessToken: () => accessToken
      });

      const unique = uniqueSuffix();
      const username = `dlq-user-${unique}`;
      const password = 'StrongPass!1234';

      await registerUser(apiClient, username, password);
      const loggedIn = await loginUser(apiClient, username, password);
      accessToken = loggedIn.data.token;

      const failedTask = await createTask(apiClient, `[fail] dlq task ${unique}`);
      const failedTaskPayload = await waitForTaskStatus(
        apiClient,
        failedTask.data.task.id,
        'failed'
      );

      expect(failedTaskPayload.data.task.status).toBe('failed');
      expect(failedTaskPayload.data.task.lastError).toContain('forced to fail');

      const dlq = await readDeadLetterQueue(apiClient);
      expect(dlq.data.failedTasks.some((task) => task.id === failedTask.data.task.id)).toBe(true);
    } finally {
      await demoApp.stopAndCleanup();
    }
  });
});
