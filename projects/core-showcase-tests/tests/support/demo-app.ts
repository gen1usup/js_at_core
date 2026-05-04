import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { AxiosHttpClient } from '@automation-platform/api-core';
import type { PlatformLogger } from '@automation-platform/contracts';
import { createLogger } from '@automation-platform/logger';

export interface DemoWebAppInstance {
  start(): Promise<{ host: string; port: number; baseUrl: string }>;
  stop(): Promise<void>;
}

export interface DemoConfigInput {
  host?: string;
  port?: number;
  dataDir?: string;
  queueName?: string;
  tokenTtlMs?: number;
  workerPollMs?: number;
}

export interface DemoAppModule {
  createDemoWebApp(input?: Partial<DemoConfigInput>): DemoWebAppInstance;
}

export interface StartedDemoWebApp {
  baseUrl: string;
  dataDir: string;
  stopAndCleanup(extraPaths?: string[]): Promise<void>;
}

export const demoAppEntryPath = path.resolve(process.cwd(), 'demo-web-app/src/app.ts');
export const hasDemoApp = existsSync(demoAppEntryPath);

export const userSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(1),
  roles: z.array(z.string().min(1))
});

export const taskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  correlationId: z.string().min(1),
  createdAtIso: z.string().min(1),
  updatedAtIso: z.string().min(1),
  lastError: z.string().optional()
});

export const envelope = <TData extends z.ZodTypeAny>(dataSchema: TData) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema
  });

export const healthSchema = z.object({
  ok: z.literal(true),
  now: z.string().min(1),
  queue: z.object({
    name: z.string().min(1),
    pending: z.number(),
    deadLetter: z.number()
  })
});

export const registerSchema = envelope(
  z.object({
    user: userSchema
  })
);

export const loginSchema = envelope(
  z.object({
    token: z.string().min(1),
    expiresAtIso: z.string().min(1),
    user: userSchema
  })
);

export const meSchema = envelope(
  z.object({
    user: userSchema
  })
);

export const taskEnvelopeSchema = envelope(
  z.object({
    task: taskSchema
  })
);

export const taskListSchema = envelope(
  z.object({
    items: z.array(taskSchema)
  })
);

export const dlqSchema = envelope(
  z.object({
    queue: z.string().min(1),
    failedTasks: z.array(taskSchema)
  })
);

export type TaskStatus = z.infer<typeof taskSchema>['status'];

export const uniqueSuffix = (): string => `${Date.now().toString(16)}-${process.pid}`;

export const startDemoWebApp = async (
  slug: string,
  inputConfig: Partial<DemoConfigInput> = {}
): Promise<StartedDemoWebApp> => {
  const imported = (await import(demoAppEntryPath)) as DemoAppModule;
  const dataDir = path.resolve('artifacts', slug, uniqueSuffix());
  const demoApp = imported.createDemoWebApp({
    port: 0,
    dataDir,
    workerPollMs: 30,
    ...inputConfig
  });

  const started = await demoApp.start();
  let stopped = false;

  return {
    baseUrl: started.baseUrl,
    dataDir,
    async stopAndCleanup(extraPaths: string[] = []) {
      if (!stopped) {
        await demoApp.stop();
        stopped = true;
      }

      await fs.rm(dataDir, { recursive: true, force: true });
      await Promise.all(
        extraPaths.map((extraPath) => fs.rm(extraPath, { recursive: true, force: true }))
      );
    }
  };
};

export const createShowcaseLogger = (serviceName: string): PlatformLogger =>
  createLogger({
    level: 'info',
    serviceName,
    environment: 'test'
  });

export const createDemoApiClient = (input: {
  baseUrl: string;
  logger?: PlatformLogger;
  getAccessToken?: () => string | undefined;
}): AxiosHttpClient =>
  new AxiosHttpClient({
    baseUrl: input.baseUrl,
    timeoutMs: 5_000,
    retry: {
      maxAttempts: 2,
      delayMs: 50,
      backoffFactor: 1
    },
    logger: input.logger ?? createShowcaseLogger('demo-api-client'),
    authTokenProvider: async () => input.getAccessToken?.()
  });

export const registerUser = (apiClient: AxiosHttpClient, username: string, password: string) =>
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
  });

export const loginUser = (apiClient: AxiosHttpClient, username: string, password: string) =>
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
  });

export const createTask = (apiClient: AxiosHttpClient, title: string, correlationId?: string) =>
  apiClient.request({
    request: {
      method: 'POST',
      path: '/api/tasks',
      body: {
        title
      },
      ...(correlationId ? { headers: { 'x-correlation-id': correlationId } } : {})
    },
    responseSchema: taskEnvelopeSchema
  });

export const getTask = (apiClient: AxiosHttpClient, taskId: string) =>
  apiClient.request({
    request: {
      method: 'GET',
      path: `/api/tasks/${taskId}`
    },
    responseSchema: taskEnvelopeSchema
  });

export const listTasks = (apiClient: AxiosHttpClient) =>
  apiClient.request({
    request: {
      method: 'GET',
      path: '/api/tasks'
    },
    responseSchema: taskListSchema
  });

export const readDeadLetterQueue = (apiClient: AxiosHttpClient) =>
  apiClient.request({
    request: {
      method: 'GET',
      path: '/api/queue/dlq'
    },
    responseSchema: dlqSchema
  });

export const waitForTaskStatus = (
  apiClient: AxiosHttpClient,
  taskId: string,
  expectedStatus: TaskStatus
) =>
  apiClient.poll(
    () => ({
      method: 'GET',
      path: `/api/tasks/${taskId}`
    }),
    (payload) => payload.data.task.status === expectedStatus,
    {
      timeoutMs: 10_000,
      pollingIntervalMs: 120,
      responseSchema: taskEnvelopeSchema
    }
  );
