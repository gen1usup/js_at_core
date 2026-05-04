# Automation Platform Core

TypeScript automation platform core / starter kit for API, DB, async job and browser e2e scenarios.

This repository is intended as a readable starter kit and demonstration project. It is not documented as production-ready; the current claim is limited to what is covered by local scripts, showcase tests and CI configuration in this repo.

## Overview

The project is an npm workspace monorepo with reusable automation modules under `packages/*`, showcase projects under `projects/*`, a local `demo-web-app`, and Playwright browser e2e tests under `tests/e2e`.

It demonstrates:

- typed API automation with Axios and zod validation;
- execution context, retries, polling and cleanup;
- queue/DLQ style async scenarios;
- diagnostics bundles and local artifacts;
- browser UI e2e through Playwright;
- a local demo app that does not require secrets or an external database.

## Current status

- Package manager: npm.
- Browser e2e: Playwright Test.
- Demo app: local Node.js HTTP server with JSON files and in-memory queue/worker.
- CI: GitHub Actions and GitLab CI run install, lint, typecheck, tests, build, validation and e2e.
- Known gap: several packages are covered by typecheck/showcase only and do not yet have package-local unit tests.

## What is included

- Core contracts, config, logging, metadata and utility packages.
- API, DB, queue, repositories and gateway primitives.
- UI contracts, selectors, Playwright driver, UI core/components/flows.
- Diagnostics and a lightweight diagnostics report plugin.
- Governance checks for metadata, selectors, config and hard sleep usage.
- CLI helpers for small scaffolding and validation commands.
- Showcase tests in `projects/core-showcase-tests` and `projects/template-webapp`.

## Quick start

```bash
npm install
npm run lint
npm run typecheck
npm test
```

Run the full local validation chain:

```bash
npm run ci
```

## Run checks

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run lint`      | ESLint over the repository          |
| `npm run typecheck` | TypeScript no-emit typecheck        |
| `npm test`          | Vitest unit/showcase tests          |
| `npm run build`     | TypeScript project references build |
| `npm run validate`  | Governance and config validation    |
| `npm run test:e2e`  | Playwright browser e2e              |
| `npm run ci`        | Local CI chain                      |

## Playwright e2e

Playwright is configured in `playwright.config.ts`. The test directory is `tests/e2e`.

If `BASE_URL` or `AP_BASE_URL` is not set, Playwright starts the local `demo-web-app` through `webServer` and uses `http://127.0.0.1:3010`.

```bash
npm run playwright:install
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:debug
npm run test:e2e:ui
npm run test:e2e:report
```

Artifacts:

- HTML report: `playwright-report/`
- traces/videos/screenshots: `test-results/`

## Demo web app

The demo app lives in `demo-web-app`. It is intentionally isolated from the core packages. It exists so API/integration/e2e showcases can run locally without external services.

```bash
npx tsx demo-web-app/src/server.ts
npx tsx demo-web-app/src/demo-scenario.ts
```

See `demo-web-app/README.md` for endpoints, data files, reset instructions and which tests use the app.

## Showcase scenarios

| Scenario                | Location                                                                                   | Demonstrates                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Simple API client       | `projects/core-showcase-tests/tests/api-client-showcase.test.ts`                           | AxiosHttpClient, zod response validation, demo app health/auth API                     |
| API + async job/polling | `projects/core-showcase-tests/tests/integration-real-demo.test.ts`                         | register/login/create task, polling, failed task/DLQ, diagnostics plugin               |
| Browser e2e             | `tests/e2e/smoke.spec.ts`                                                                  | Playwright locator-first browser flow against demo app                                 |
| Diagnostics/artifacts   | `projects/core-showcase-tests/tests/core-capabilities-showcase.test.ts` and real demo test | failure bundle and diagnostics report JSON                                             |
| Mock core showcase      | `projects/core-showcase-tests/tests/core-capabilities-showcase.test.ts`                    | contracts, fake UI driver, repositories, queue, cleanup                                |
| Template project        | `projects/template-webapp/tests/template.test.ts`                                          | project adapter, selectors, repositories, gateway and queue-aware flow without browser |

## Project structure

```text
packages/              reusable platform modules
projects/              showcase/template projects
demo-web-app/          local app used by API and e2e showcases
tests/e2e/             Playwright browser tests
scripts/               validation helpers
.github/workflows/     GitHub Actions CI
.gitlab-ci.yml         GitLab CI
```

## Module documentation

- [@automation-platform/api-core](packages/api-core/README.md)
- [@automation-platform/cli](packages/cli/README.md)
- [@automation-platform/config](packages/config/README.md)
- [@automation-platform/contracts](packages/contracts/README.md)
- [@automation-platform/data-support](packages/data-support/README.md)
- [@automation-platform/db-core](packages/db-core/README.md)
- [@automation-platform/diagnostics](packages/diagnostics/README.md)
- [@automation-platform/execution](packages/execution/README.md)
- [@automation-platform/gateways](packages/gateways/README.md)
- [@automation-platform/governance](packages/governance/README.md)
- [@automation-platform/logger](packages/logger/README.md)
- [@automation-platform/metadata](packages/metadata/README.md)
- [@automation-platform/plugins](packages/plugins/README.md)
- [@automation-platform/queue-core](packages/queue-core/README.md)
- [@automation-platform/repositories](packages/repositories/README.md)
- [@automation-platform/selectors](packages/selectors/README.md)
- [@automation-platform/ui-components](packages/ui-components/README.md)
- [@automation-platform/ui-core](packages/ui-core/README.md)
- [@automation-platform/ui-driver](packages/ui-driver/README.md)
- [@automation-platform/ui-flows](packages/ui-flows/README.md)
- [@automation-platform/utils](packages/utils/README.md)

## CI

GitHub Actions and GitLab CI use Node.js 22, npm, Playwright Chromium installation and repository scripts from `package.json`.

CI uploads local artifacts when available:

- `artifacts/`
- `coverage/`
- `playwright-report/`
- `test-results/`

## Limitations

- This is a starter kit and showcase, not a proven production framework.
- `db-core` has a PostgreSQL client but no local PostgreSQL integration service in CI.
- Several UI packages are covered by typecheck/showcase only, not dedicated unit tests.
- `plugins` currently implements diagnostics JSON output; other plugin contracts are placeholders for future implementation.
- The demo app stores data in local JSON files and is not intended as an application template.

## Next steps

- Add package-local tests for `ui-core`, `ui-components`, `ui-flows`, `ui-driver`, `cli` and `plugins`.
- Add optional PostgreSQL integration tests for `db-core` using a controlled local service.
- Add a short architecture diagram once the API boundaries stabilize.
- Decide whether CLI scaffolding should stay minimal or become a separately versioned tool.
