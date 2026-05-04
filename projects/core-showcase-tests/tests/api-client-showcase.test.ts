import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AxiosHttpClient } from '@automation-platform/api-core';
import { createLogger } from '@automation-platform/logger';

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

const healthSchema = z.object({
  ok: z.literal(true),
  now: z.string().min(1),
  queue: z.object({
    name: z.string().min(1),
    pending: z.number(),
    deadLetter: z.number()
  })
});

const userSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  roles: z.array(z.string().min(1))
});

const registerSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    user: userSchema
  })
});

const loginSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    token: z.string().min(1),
    expiresAtIso: z.string().min(1),
    user: userSchema
  })
});

describe('API client showcase against demo-web-app', () => {
  maybeIt('uses AxiosHttpClient for a simple request/response/schema-validation flow', async () => {
    const demoDataDir = path.resolve('artifacts', 'demo-api-showcase-data', `${Date.now()}`);
    const imported = (await import(demoAppEntryPath)) as DemoAppModule;
    const demoApp = imported.createDemoWebApp({
      port: 0,
      dataDir: demoDataDir,
      workerPollMs: 30
    });

    const started = await demoApp.start();

    try {
      let accessToken: string | undefined;
      const logger = createLogger({
        level: 'info',
        serviceName: 'api-client-showcase-test',
        environment: 'test'
      });

      const apiClient = new AxiosHttpClient({
        baseUrl: started.baseUrl,
        timeoutMs: 5_000,
        retry: {
          maxAttempts: 2,
          delayMs: 50,
          backoffFactor: 1
        },
        logger,
        authTokenProvider: async () => accessToken
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

      const unique = Date.now().toString(16);
      const username = `api-user-${unique}`;
      const password = 'StrongPass!1234';

      const registered = await apiClient.request({
        request: {
          method: 'POST',
          path: '/api/auth/register',
          body: {
            username,
            password
          }
        },
        responseSchema: registerSchema
      });

      expect(registered.data.user.username).toBe(username);

      const loggedIn = await apiClient.request({
        request: {
          method: 'POST',
          path: '/api/auth/login',
          body: {
            username,
            password
          }
        },
        responseSchema: loginSchema
      });

      accessToken = loggedIn.data.token;
      expect(loggedIn.data.user.id).toBe(registered.data.user.id);
    } finally {
      await demoApp.stop();
      await fs.rm(demoDataDir, { recursive: true, force: true });
    }
  });
});
