# Core Showcase Tests

Vitest showcase project for the automation core modules.

## Scenarios

- `tests/api-client-showcase.test.ts`: simple AxiosHttpClient request/response/schema-validation flow against demo-web-app.
- `tests/integration-real-demo.test.ts`: real demo app integration with register/login/task polling/failed task/DLQ/diagnostics plugin.
- `tests/core-capabilities-showcase.test.ts`: mock-driven core capabilities showcase with fake HTTP, DB and UI driver contracts.

## Run

```bash
npm test
npx vitest run projects/core-showcase-tests/tests/**/*.test.ts
```

The real demo tests start `demo-web-app` on a random port and clean temporary data under `artifacts/`.
