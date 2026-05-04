import fs from 'node:fs/promises';
import path from 'node:path';
import { createDemoWebApp } from './app';

interface ApiResponse<TData> {
  ok: boolean;
  data?: TData;
  error?: {
    message: string;
  };
}

const run = async (): Promise<void> => {
  const scenarioDataDir = path.resolve(process.cwd(), 'demo-web-app/.scenario-data');
  await fs.rm(scenarioDataDir, { recursive: true, force: true });

  const app = createDemoWebApp({
    port: 0,
    dataDir: scenarioDataDir,
    workerPollMs: 50
  });

  const started = await app.start();

  const request = async <TData>(
    method: 'GET' | 'POST',
    pathname: string,
    options: {
      token?: string;
      body?: Record<string, unknown>;
    } = {}
  ): Promise<TData> => {
    const url = `${started.baseUrl}${pathname}`;
    const headers: Record<string, string> = {
      'content-type': 'application/json'
    };

    if (options.token) {
      headers.authorization = `Bearer ${options.token}`;
    }

    const requestInit: RequestInit = {
      method,
      headers
    };

    if (options.body) {
      requestInit.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, requestInit);

    const payload = (await response.json()) as ApiResponse<TData>;

    if (!response.ok || !payload.ok || !payload.data) {
      throw new Error(payload.error?.message ?? `Request failed: ${method} ${pathname}`);
    }

    return payload.data;
  };

  try {
    const uniqueSuffix = Date.now().toString(16);
    const username = `scenario-${uniqueSuffix}`;
    const password = 'S3curePass!123';

    await request<{ user: { id: string } }>('POST', '/api/auth/register', {
      body: {
        username,
        password
      }
    });

    const login = await request<{
      token: string;
      expiresAtIso: string;
      user: { id: string; username: string };
    }>('POST', '/api/auth/login', {
      body: {
        username,
        password
      }
    });

    const created = await request<{
      task: { id: string; status: string };
    }>('POST', '/api/tasks', {
      token: login.token,
      body: {
        title: 'demo scenario task'
      }
    });

    let finalStatus = created.task.status;

    for (let attempt = 1; attempt <= 120; attempt += 1) {
      const taskPayload = await request<{
        task: { id: string; status: string };
      }>('GET', `/api/tasks/${created.task.id}`, {
        token: login.token
      });

      finalStatus = taskPayload.task.status;

      if (finalStatus === 'completed') {
        break;
      }

      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });
    }

    if (finalStatus !== 'completed') {
      throw new Error(`Expected completed status, got ${finalStatus}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl: started.baseUrl,
          user: login.user.username,
          taskId: created.task.id,
          status: finalStatus
        },
        null,
        2
      )
    );
  } finally {
    await app.stop();
  }
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exit(1);
});
