import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { AuthService } from './auth';
import { loadDemoConfig } from './config';
import { JsonDatabases } from './database';
import { createLogger } from './logger';
import { InMemoryQueue, TaskWorker } from './queue';
import type { DemoConfig, PublicUser, TaskRecord } from './types';
import { assertObject, readString, ValidationError } from './validation';

class HttpError extends Error {
  public constructor(
    public readonly status: number,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const nowIso = (): string => new Date().toISOString();

const sendJson = (
  response: ServerResponse,
  status: number,
  payload: Record<string, unknown>
): void => {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(`${JSON.stringify(payload)}\n`);
};

const sendHtml = (response: ServerResponse, html: string): void => {
  response.statusCode = 200;
  response.setHeader('content-type', 'text/html; charset=utf-8');
  response.end(html);
};

const readRequestBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf8');
};

const readJsonBody = async (request: IncomingMessage): Promise<Record<string, unknown>> => {
  const raw = await readRequestBody(request);

  if (raw.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return assertObject(parsed, 'Request body must be a JSON object');
  } catch {
    throw new HttpError(400, 'Invalid JSON payload');
  }
};

const extractBearerToken = (request: IncomingMessage): string | undefined => {
  const authorizationHeader = request.headers.authorization;

  if (typeof authorizationHeader !== 'string') {
    return undefined;
  }

  if (!authorizationHeader.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }

  const token = authorizationHeader.slice('bearer '.length).trim();
  return token.length > 0 ? token : undefined;
};

const renderUiPage = (): string => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Demo Web App</title>
    <style>
      body { font-family: Arial, sans-serif; max-width: 860px; margin: 20px auto; padding: 0 12px; }
      .card { border: 1px solid #d5d5d5; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
      input, button { padding: 8px; margin: 4px 0; }
      button { cursor: pointer; }
      pre { background: #f6f8fa; padding: 10px; border-radius: 6px; overflow: auto; }
      .row { display: flex; gap: 12px; flex-wrap: wrap; }
    </style>
  </head>
  <body>
    <h1>Demo Web App</h1>
    <p>Minimal demo: API, authentication, file DB, queue, and worker.</p>

    <div class="card">
      <h2>Auth</h2>
      <div class="row">
        <input id="username" placeholder="username" value="demo-user" />
        <input id="password" placeholder="password" value="P@ssw0rd123" type="password" />
      </div>
      <button id="register">Register</button>
      <button id="login">Login</button>
      <button id="logout">Logout</button>
    </div>

    <div class="card">
      <h2>Tasks</h2>
      <input id="title" placeholder="task title" value="process demo payload" style="width: 100%;" />
      <button id="create-task">Create Task</button>
      <button id="refresh-tasks">Refresh Tasks</button>
    </div>

    <div class="card">
      <h2>Output</h2>
      <pre id="output">ready</pre>
    </div>

    <script>
      const output = document.getElementById('output');
      const setOutput = (value) => {
        output.textContent = JSON.stringify(value, null, 2);
      };

      let token = localStorage.getItem('demo_token') || '';

      const request = async (path, options = {}) => {
        const headers = Object.assign({}, options.headers || {}, { 'Content-Type': 'application/json' });
        if (token) {
          headers.Authorization = 'Bearer ' + token;
        }

        const response = await fetch(path, Object.assign({}, options, { headers }));
        const text = await response.text();
        const body = text ? JSON.parse(text) : {};

        if (!response.ok) {
          throw body;
        }

        return body;
      };

      document.getElementById('register').addEventListener('click', async () => {
        try {
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          const result = await request('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
          });
          setOutput(result);
        } catch (error) {
          setOutput(error);
        }
      });

      document.getElementById('login').addEventListener('click', async () => {
        try {
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          const result = await request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
          });
          token = result.data.token;
          localStorage.setItem('demo_token', token);
          setOutput(result);
        } catch (error) {
          setOutput(error);
        }
      });

      document.getElementById('logout').addEventListener('click', async () => {
        try {
          const result = await request('/api/auth/logout', { method: 'POST' });
          token = '';
          localStorage.removeItem('demo_token');
          setOutput(result);
        } catch (error) {
          setOutput(error);
        }
      });

      document.getElementById('create-task').addEventListener('click', async () => {
        try {
          const title = document.getElementById('title').value;
          const result = await request('/api/tasks', {
            method: 'POST',
            body: JSON.stringify({ title })
          });
          setOutput(result);
        } catch (error) {
          setOutput(error);
        }
      });

      document.getElementById('refresh-tasks').addEventListener('click', async () => {
        try {
          const result = await request('/api/tasks', { method: 'GET' });
          setOutput(result);
        } catch (error) {
          setOutput(error);
        }
      });
    </script>
  </body>
</html>`;

const parseTaskIdFromPath = (pathname: string): string | null => {
  const matched = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (!matched || !matched[1]) {
    return null;
  }

  return decodeURIComponent(matched[1]);
};

const ensureAuthenticated = async (
  request: IncomingMessage,
  authService: AuthService
): Promise<PublicUser> => {
  const token = extractBearerToken(request);
  const user = await authService.resolveUserByToken(token);

  if (!user) {
    throw new HttpError(401, 'Unauthorized');
  }

  return user;
};

const mapTaskResponse = (task: TaskRecord): Record<string, unknown> => ({
  id: task.id,
  title: task.title,
  status: task.status,
  correlationId: task.correlationId,
  createdAtIso: task.createdAtIso,
  updatedAtIso: task.updatedAtIso,
  ...(task.lastError ? { lastError: task.lastError } : {})
});

export interface DemoWebApp {
  start(): Promise<{ host: string; port: number; baseUrl: string }>;
  stop(): Promise<void>;
  config: DemoConfig;
}

export const createDemoWebApp = (inputConfig?: Partial<DemoConfig>): DemoWebApp => {
  const baseConfig = loadDemoConfig();
  const config: DemoConfig = {
    ...baseConfig,
    ...inputConfig
  };

  const logger = createLogger('info').child({ service: 'demo-web-app' });
  const db = new JsonDatabases(config.dataDir);
  const queue = new InMemoryQueue();
  const authService = new AuthService(db, config.tokenTtlMs);

  const worker = new TaskWorker({
    queue,
    database: db,
    logger,
    options: {
      queueName: config.queueName,
      pollIntervalMs: config.workerPollMs
    }
  });

  const server = http.createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', 'http://localhost');
      const pathname = requestUrl.pathname;
      const method = request.method ?? 'GET';

      if (method === 'GET' && pathname === '/') {
        sendHtml(response, renderUiPage());
        return;
      }

      if (method === 'GET' && pathname === '/health') {
        sendJson(response, 200, {
          ok: true,
          now: nowIso(),
          queue: {
            name: config.queueName,
            pending: queue.size(config.queueName),
            deadLetter: queue.size(`${config.queueName}.dlq`)
          }
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/auth/register') {
        const body = await readJsonBody(request);
        const username = readString(body, 'username', { minLength: 3, maxLength: 60 });
        const password = readString(body, 'password', { minLength: 8, maxLength: 256 });

        const user = await authService.register({ username, password });
        sendJson(response, 201, {
          ok: true,
          data: { user }
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/auth/login') {
        const body = await readJsonBody(request);
        const username = readString(body, 'username', { minLength: 3, maxLength: 60 });
        const password = readString(body, 'password', { minLength: 8, maxLength: 256 });

        const result = await authService.login({ username, password });

        sendJson(response, 200, {
          ok: true,
          data: result
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/auth/logout') {
        const token = extractBearerToken(request);
        await authService.logout(token);

        sendJson(response, 200, {
          ok: true,
          data: {
            loggedOut: true
          }
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/auth/me') {
        const user = await ensureAuthenticated(request, authService);

        sendJson(response, 200, {
          ok: true,
          data: { user }
        });
        return;
      }

      if (method === 'POST' && pathname === '/api/tasks') {
        const user = await ensureAuthenticated(request, authService);
        const body = await readJsonBody(request);

        const title = readString(body, 'title', { minLength: 3, maxLength: 160 });

        const correlationIdHeader = request.headers['x-correlation-id'];
        const correlationId =
          typeof correlationIdHeader === 'string' && correlationIdHeader.trim().length > 0
            ? correlationIdHeader.trim()
            : `corr-${randomUUID()}`;

        const task = await db.createTask({
          title,
          ownerUserId: user.id,
          correlationId
        });

        queue.publish({
          queue: config.queueName,
          payload: {
            taskId: task.id,
            ownerUserId: user.id
          },
          correlationId
        });

        sendJson(response, 202, {
          ok: true,
          data: {
            task: mapTaskResponse(task)
          }
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/tasks') {
        const user = await ensureAuthenticated(request, authService);
        const tasks = await db.listTasksByOwner(user.id);

        sendJson(response, 200, {
          ok: true,
          data: {
            items: tasks.map((task) => mapTaskResponse(task))
          }
        });
        return;
      }

      if (method === 'GET' && pathname.startsWith('/api/tasks/')) {
        const user = await ensureAuthenticated(request, authService);
        const taskId = parseTaskIdFromPath(pathname);

        if (!taskId) {
          throw new HttpError(404, 'Not found');
        }

        const task = await db.getTaskById(taskId);
        if (!task || task.ownerUserId !== user.id) {
          throw new HttpError(404, 'Task not found');
        }

        sendJson(response, 200, {
          ok: true,
          data: {
            task: mapTaskResponse(task)
          }
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/queue/metrics') {
        const user = await ensureAuthenticated(request, authService);
        const isAdmin = user.roles.includes('admin');

        if (!isAdmin) {
          throw new HttpError(403, 'Queue metrics are available only for admin users');
        }

        sendJson(response, 200, {
          ok: true,
          data: {
            queue: config.queueName,
            pending: queue.size(config.queueName),
            deadLetter: queue.size(`${config.queueName}.dlq`)
          }
        });
        return;
      }

      if (method === 'GET' && pathname === '/api/queue/dlq') {
        const user = await ensureAuthenticated(request, authService);
        const tasks = await db.listTasksByOwner(user.id);

        const failedTasks = tasks.filter((task) => task.status === 'failed');

        sendJson(response, 200, {
          ok: true,
          data: {
            queue: `${config.queueName}.dlq`,
            failedTasks: failedTasks.map((task) => mapTaskResponse(task))
          }
        });
        return;
      }

      throw new HttpError(404, 'Not found');
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(response, error.status, {
          ok: false,
          error: {
            message: error.message,
            details: error.details
          }
        });
        return;
      }

      if (error instanceof ValidationError) {
        const status = error.message.toLowerCase().includes('already exists') ? 409 : 400;
        sendJson(response, status, {
          ok: false,
          error: {
            message: error.message
          }
        });
        return;
      }

      const message = error instanceof Error ? error.message : 'Internal server error';

      logger.error('Unhandled request error', {
        error: message
      });

      sendJson(response, 500, {
        ok: false,
        error: {
          message: 'Internal server error'
        }
      });
    }
  });

  return {
    config,
    async start() {
      await db.initialize();
      worker.start();

      await new Promise<void>((resolve, reject) => {
        server.listen(config.port, config.host, () => resolve());
        server.once('error', reject);
      });

      const address = server.address();

      if (!address || typeof address === 'string') {
        throw new Error('Cannot determine listening address');
      }

      const host = address.address;
      const port = (address as AddressInfo).port;
      const baseUrl = `http://${host}:${port}`;

      logger.info('Demo web app started', {
        host,
        port,
        baseUrl,
        dataDir: config.dataDir
      });

      return {
        host,
        port,
        baseUrl
      };
    },
    async stop() {
      await worker.stop();

      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      logger.info('Demo web app stopped');
    }
  };
};
