# Demo Web App

## Purpose

`demo-web-app` is a local HTTP application used to demonstrate the automation core without external services. It supports auth, task creation, JSON file persistence, an in-memory queue worker, and a failed-task DLQ view.

## How it is used by tests

- Vitest API showcase tests start it on a random port with a temporary data directory.
- Playwright e2e starts it through `playwright.config.ts` when `BASE_URL` and `AP_BASE_URL` are not provided.
- Playwright e2e passes `DEMO_DATA_DIR=artifacts/demo-e2e-data`, so browser runs do not write to the default manual data directory.
- Tests create unique users and tasks, so a reset endpoint is not required for current scenarios.

## Local start

```bash
npx tsx demo-web-app/src/server.ts
```

The server logs the selected `baseUrl`. By default it uses `127.0.0.1:3010`.

## Environment

- `DEMO_HOST`: host, default `127.0.0.1`.
- `DEMO_PORT`: port, default `3010`.
- `DEMO_DATA_DIR`: JSON data directory, default `demo-web-app/data`.
- `DEMO_QUEUE_NAME`: queue name, default `demo.task.jobs`.
- `DEMO_TOKEN_TTL_MS`: token TTL.
- `DEMO_WORKER_POLL_MS`: worker polling interval.

## API endpoints

| Method | Path                 | Description               | Auth            |
| ------ | -------------------- | ------------------------- | --------------- |
| `GET`  | `/`                  | HTML demo UI              | No              |
| `GET`  | `/health`            | Health and queue counts   | No              |
| `POST` | `/api/auth/register` | Create user               | No              |
| `POST` | `/api/auth/login`    | Create bearer token       | No              |
| `POST` | `/api/auth/logout`   | Revoke current token      | Yes             |
| `GET`  | `/api/auth/me`       | Resolve current user      | Yes             |
| `POST` | `/api/tasks`         | Create queued task        | Yes             |
| `GET`  | `/api/tasks`         | List current user tasks   | Yes             |
| `GET`  | `/api/tasks/:id`     | Read one task             | Yes             |
| `GET`  | `/api/queue/metrics` | Admin queue metrics       | Yes, admin only |
| `GET`  | `/api/queue/dlq`     | Current user failed tasks | Yes             |

## Data storage

The app stores JSON files in the configured data directory:

- `auth-db.json`: users and sessions.
- `app-db.json`: tasks.

Vitest tests use temporary directories under `artifacts/` and remove them during cleanup. Manual runs use `demo-web-app/data`, which is ignored by git.

## Queue and worker

- New tasks are stored as `queued` and published to the in-memory queue.
- The worker marks normal tasks as `processing` and then `completed`.
- A task title containing `[fail]` forces worker failure; the task becomes `failed` and is represented through `/api/queue/dlq`.

## Reset / cleanup

There is no reset endpoint because current tests avoid shared state with unique users and temporary data directories. For manual cleanup, stop the server and remove `demo-web-app/data` or the custom `DEMO_DATA_DIR`.

## Related tests

- `projects/core-showcase-tests/tests/api-client-showcase.test.ts`.
- `projects/core-showcase-tests/tests/api-async-job.test.ts`.
- `projects/core-showcase-tests/tests/api-dlq.test.ts`.
- `projects/core-showcase-tests/tests/integration-real-demo.test.ts`.
- `tests/e2e/smoke.spec.ts`: browser flow through registration, login, task creation, and queued state.
- `tests/e2e/async-flow.spec.ts`: browser flow that refreshes the task list until the worker-completed state is visible.

## Limitations

- The queue is in memory and exists only while the process runs.
- JSON persistence is useful for local demos, not concurrent multi-process storage.
- There is no external identity provider, role management UI, or database server.
