# Demo Web App

Local demonstration app used by API, async job and Playwright browser e2e showcases.

It is intentionally isolated from `@automation-platform/*` packages. The app can be removed without changing the core packages; it exists to make the starter kit runnable without external services.

## Purpose

The app gives tests a realistic but small target with authentication, an HTTP API, JSON file storage, an in-memory queue and a background worker.

## What it demonstrates

- user registration and login;
- Bearer token authorization;
- task creation through API and browser UI;
- async task processing through a queue worker;
- failed task path through `[fail]` title marker and DLQ-style endpoint;
- local state reset through data directory cleanup.

## Start locally

```bash
npm install
npx tsc -p demo-web-app/tsconfig.json --noEmit
npx tsx demo-web-app/src/server.ts
```

Default URL: `http://127.0.0.1:3010`.

## API smoke scenario without browser

This scenario starts the app on a random port, performs register/login/create task/wait completed, then stops the app.

```bash
npx tsx demo-web-app/src/demo-scenario.ts
```

## Playwright browser e2e from repository root

The browser test opens the UI, registers a unique user, logs in, creates a task and verifies the JSON output through Playwright locators.

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:debug
```

If `BASE_URL` or `AP_BASE_URL` is not set, `playwright.config.ts` starts this app through Playwright `webServer` and uses `http://127.0.0.1:3010`.

To run against an already started app:

```bash
BASE_URL=http://127.0.0.1:3010 npm run test:e2e
```

On PowerShell:

```powershell
$env:BASE_URL='http://127.0.0.1:3010'
npm run test:e2e
```

## Configuration

| Env var               | Default               | Meaning                                          |
| --------------------- | --------------------- | ------------------------------------------------ |
| `DEMO_HOST`           | `127.0.0.1`           | Host to bind                                     |
| `DEMO_PORT`           | `3010`                | Port to bind; tests can pass `0` for random port |
| `DEMO_DATA_DIR`       | `./demo-web-app/data` | JSON file data directory                         |
| `DEMO_QUEUE_NAME`     | `demo.task.jobs`      | Queue name used by worker                        |
| `DEMO_TOKEN_TTL_MS`   | `3600000`             | Login token TTL                                  |
| `DEMO_WORKER_POLL_MS` | `250`                 | Worker polling interval                          |

## Endpoints

| Method/path               | Auth           | Purpose                        |
| ------------------------- | -------------- | ------------------------------ |
| `GET /`                   | no             | Browser demo UI                |
| `GET /health`             | no             | Health and queue size snapshot |
| `POST /api/auth/register` | no             | Create user                    |
| `POST /api/auth/login`    | no             | Create token                   |
| `POST /api/auth/logout`   | token optional | Invalidate token when provided |
| `GET /api/auth/me`        | yes            | Current user                   |
| `POST /api/tasks`         | yes            | Create queued task             |
| `GET /api/tasks`          | yes            | List current user tasks        |
| `GET /api/tasks/:id`      | yes            | Get one task                   |
| `GET /api/queue/metrics`  | admin only     | Queue sizes                    |
| `GET /api/queue/dlq`      | yes            | Failed tasks for current user  |

## Data and reset

Default data files:

- `demo-web-app/data/auth-db.json`
- `demo-web-app/data/app-db.json`

To reset local state, stop the app and delete `demo-web-app/data/`, or set `DEMO_DATA_DIR` to a temporary directory for a single run.

Automated tests usually pass their own temporary directory under `artifacts/` and remove it during cleanup.

## Queue and failed path

Creating a task publishes a message to the in-memory queue. The worker marks normal tasks as `completed`.

To force a failed task, include `[fail]` in the task title:

```json
{
  "title": "[fail] force worker error"
}
```

The worker marks that task as `failed`; `GET /api/queue/dlq` exposes failed tasks for the current user.

## Tests that use this app

- `projects/core-showcase-tests/tests/api-client-showcase.test.ts` for a simple API client scenario.
- `projects/core-showcase-tests/tests/integration-real-demo.test.ts` for API + async job/polling + diagnostics.
- `tests/e2e/smoke.spec.ts` for Playwright browser e2e.
- `demo-web-app/src/demo-scenario.ts` for a standalone API smoke run.

## Limitations

- The app is a test target, not a production web app template.
- Data storage is JSON files, not a database server.
- The queue is in-memory and exists only for the process lifetime.
- Authentication is intentionally simple for demo purposes.
