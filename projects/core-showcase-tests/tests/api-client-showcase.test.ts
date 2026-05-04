import { describe, expect, it } from 'vitest';
import {
  createDemoApiClient,
  createShowcaseLogger,
  hasDemoApp,
  healthSchema,
  loginUser,
  registerUser,
  startDemoWebApp,
  uniqueSuffix
} from './support/demo-app';

const maybeIt = hasDemoApp ? it : it.skip;

describe('API client showcase against demo-web-app', () => {
  maybeIt(
    'performs a simple request/response/schema-validation flow without browser runtime',
    async () => {
      const demoApp = await startDemoWebApp('demo-api-showcase-data');

      try {
        let accessToken: string | undefined;
        const apiClient = createDemoApiClient({
          baseUrl: demoApp.baseUrl,
          logger: createShowcaseLogger('api-client-showcase-test'),
          getAccessToken: () => accessToken
        });

        const health = await apiClient.request({
          request: {
            method: 'GET',
            path: '/health'
          },
          responseSchema: healthSchema
        });

        expect(health.ok).toBe(true);
        expect(health.queue.name).toBe('demo.task.jobs');

        const unique = uniqueSuffix();
        const username = `api-user-${unique}`;
        const password = 'StrongPass!1234';

        const registered = await registerUser(apiClient, username, password);
        expect(registered.data.user.username).toBe(username);

        const loggedIn = await loginUser(apiClient, username, password);
        accessToken = loggedIn.data.token;

        expect(loggedIn.data.user.id).toBe(registered.data.user.id);
        expect(accessToken.length).toBeGreaterThan(20);
      } finally {
        await demoApp.stopAndCleanup();
      }
    }
  );
});
