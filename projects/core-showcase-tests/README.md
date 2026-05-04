# Core Showcase Tests

This project contains Vitest scenarios that demonstrate the automation core without relying on browser runtime for most checks.

## Scenarios

- `api-client-showcase.test.ts`: simple API request/response/schema validation against `demo-web-app`.
- `api-async-job.test.ts`: create task and poll worker completion.
- `api-dlq.test.ts`: force task failure and verify DLQ visibility.
- `diagnostics-artifacts.test.ts`: create diagnostics bundle and plugin report artifacts.
- `integration-real-demo.test.ts`: combine config, metadata, execution context, API client, file DB checks, and cleanup.
- `core-capabilities-showcase.test.ts`: mock/core contract showcase without external runtime.

## Run

```bash
npm test
```

The demo app scenarios start `demo-web-app` on a random port with a temporary data directory under `artifacts/` and clean it up after each test.
