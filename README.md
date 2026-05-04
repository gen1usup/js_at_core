# js_at_core

TypeScript automation platform core / starter kit for API, file-backed demo data, async job polling, diagnostics, governance checks, and Playwright-based browser e2e scenarios.

## Overview

This repository is an evolving automation core. It keeps reusable platform packages in `packages/*`, runnable showcase projects in `projects/*`, and a local `demo-web-app` that lets examples run without external secrets or an external database.

The goal is practical onboarding: a new engineer should be able to install dependencies, run core checks, run browser e2e against the demo app, and understand which module owns which responsibility.

## Current status

- npm is the package manager; `package-lock.json` is committed.
- TypeScript is strict through the shared base config.
- Unit and showcase tests run with Vitest.
- Browser e2e runs with Playwright Test and Chromium.
- The local demo app uses JSON files and an in-memory queue worker, so it does not require secrets or external services.
- Some packages are contract or starter-kit modules and have limited direct unit coverage; this is documented in each package README.

## What problems this project solves

- Gives automation engineers a typed core for API clients, execution context, cleanup, metadata, selectors, queue polling, diagnostics, and reusable UI contracts.
- Provides local demo scenarios for API smoke, async job polling, failure diagnostics, and browser UI flows.
- Keeps governance checks close to the repository so stale docs, missing module README sections, and over-strong claims are caught early.

## What is included

- `packages/*`: reusable TypeScript modules.
- `projects/template-webapp`: template-style example package that exercises API, DB, gateway, selectors, and queue contracts without a browser.
- `projects/core-showcase-tests`: Vitest showcase tests for core/API/queue/diagnostics behavior.
- `demo-web-app`: local HTTP app for auth, tasks, JSON persistence, queue worker, and DLQ scenarios.
- `tests/e2e`: Playwright browser smoke and async UI flow tests against the demo app.
- `.github/workflows/ci.yml` and `.gitlab-ci.yml`: CI definitions aligned with root npm scripts.

## Architecture map

- Contracts: `@automation-platform/contracts` defines shared interfaces.
- Core services: `config`, `logger`, `execution`, `metadata`, `utils` support test runtime behavior.
- Data/API/queue: `api-core`, `db-core`, `queue-core`, `repositories`, `gateways`, `data-support` cover integration-side patterns.
- UI layer: `selectors`, `ui-components`, `ui-core`, `ui-flows`, `ui-driver` provide typed abstractions around UI contracts and Playwright runtime integration.
- Governance/diagnostics/plugins: `governance`, `diagnostics`, `plugins` validate conventions and persist failure artifacts.
- Showcases: `projects/*`, `demo-web-app`, and `tests/e2e` demonstrate how the pieces fit together.

## Required tools

- Node.js `>=20.11`.
- npm on `PATH` for normal commands.
- On this Windows workstation, if `npm` is not on `PATH`, prepend `C:\Program Files\nodejs` before running commands in the current shell.
- Playwright Chromium browser installed through `npm run playwright:install`.

## Installation

```bash
npm install
npm run playwright:install
```

## Environment variables

- `BASE_URL` or `AP_BASE_URL`: external app URL for Playwright e2e. If neither is set, Playwright starts `demo-web-app` locally.
- `AP_PROJECT_NAME`, `AP_API_ENABLED`, `AP_QUEUE_ENABLED`, `AP_DB_ENABLED`, `AP_DIAGNOSTICS_ENABLED`: used by config and showcase tests when they build platform config.
- `DEMO_HOST`, `DEMO_PORT`, `DEMO_DATA_DIR`, `DEMO_QUEUE_NAME`, `DEMO_TOKEN_TTL_MS`, `DEMO_WORKER_POLL_MS`: optional demo app settings.

## Run checks

| Command                  | What it does                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `npm run check:unicode`  | Fails on hidden or bidirectional Unicode in important text/config files.                                |
| `npm run format:check`   | Verifies Prettier formatting.                                                                           |
| `npm run lint`           | Runs root ESLint 9 flat-config linting.                                                                 |
| `npm run typecheck`      | Runs root TypeScript typecheck for packages, projects, scripts, e2e, and Playwright config.             |
| `npm run demo:typecheck` | Runs TypeScript typecheck for `demo-web-app`.                                                           |
| `npm test`               | Runs Vitest unit and showcase tests.                                                                    |
| `npm run build`          | Builds TypeScript project references.                                                                   |
| `npm run validate`       | Runs Unicode, format, lint, typecheck, demo typecheck, tests, platform validation, and docs validation. |
| `npm run ci:core`        | Runs `validate` and `build`.                                                                            |
| `npm run ci:e2e`         | Runs Playwright e2e.                                                                                    |
| `npm run ci`             | Runs `ci:core` and `ci:e2e`.                                                                            |

`npm run validate` is the main local quality gate for non-browser checks.

## Playwright e2e

- Config: `playwright.config.ts`.
- Test directory: `tests/e2e`.
- Browser project: Chromium.
- Default URL: `BASE_URL ?? AP_BASE_URL ?? http://127.0.0.1:3010`.
- If no external URL is provided, Playwright starts `demo-web-app/src/server.ts` through `webServer`.
- Local Playwright `webServer` uses `DEMO_DATA_DIR=artifacts/demo-e2e-data` so browser tests do not write to the default manual demo data directory.
- Artifacts: `playwright-report/` and `test-results/`.

```bash
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:debug
npm run test:e2e:ui
npm run test:e2e:report
```

Use raw `@playwright/test` for browser tests, locators, assertions, traces, screenshots, videos, and the HTML report. Use `PlaywrightUiDriver` only when a platform-level `UIDriver` contract is needed outside Playwright Test; it does not replace Playwright Test.

## Demo web app

`demo-web-app` is a local showcase app. It exposes auth endpoints, task endpoints, health checks, JSON file persistence, an in-memory queue worker, and a failed-task DLQ view. It is intentionally small and local-first.

```bash
npx tsx demo-web-app/src/server.ts
```

See [demo-web-app/README.md](demo-web-app/README.md) for endpoints, storage, queue behavior, and reset/cleanup notes.

## Showcase scenarios

| Scenario              | File                                                                    | Runner     | Demonstrates                                                      |
| --------------------- | ----------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| API smoke             | `projects/core-showcase-tests/tests/api-client-showcase.test.ts`        | Vitest     | `AxiosHttpClient`, response schema validation, local demo app     |
| API async job         | `projects/core-showcase-tests/tests/api-async-job.test.ts`              | Vitest     | task creation, polling, worker completion                         |
| API DLQ               | `projects/core-showcase-tests/tests/api-dlq.test.ts`                    | Vitest     | forced task failure, failed status, DLQ visibility                |
| Diagnostics artifacts | `projects/core-showcase-tests/tests/diagnostics-artifacts.test.ts`      | Vitest     | failure bundle, manifest, diagnostics plugin report               |
| Real core integration | `projects/core-showcase-tests/tests/integration-real-demo.test.ts`      | Vitest     | config, metadata, execution context, API client, cleanup, file DB |
| Mock core showcase    | `projects/core-showcase-tests/tests/core-capabilities-showcase.test.ts` | Vitest     | platform contracts without browser/runtime dependencies           |
| Template scenario     | `projects/template-webapp/tests/template.test.ts`                       | Vitest     | template queue-aware flow without browser runtime                 |
| Browser smoke         | `tests/e2e/smoke.spec.ts`                                               | Playwright | register, login, create task through UI and verify queued state   |
| Browser async flow    | `tests/e2e/async-flow.spec.ts`                                          | Playwright | refresh UI until worker-completed task is visible                 |

## Project structure

```text
packages/                   Reusable automation modules
projects/template-webapp     Template-style example package
projects/core-showcase-tests Vitest showcase tests
demo-web-app/                Local app used by API and browser showcases
tests/e2e/                   Playwright browser e2e tests
scripts/                     Validation scripts
.github/workflows/           GitHub Actions CI
.gitlab-ci.yml               GitLab CI
```

## Module documentation

- [api-core](packages/api-core/README.md)
- [cli](packages/cli/README.md)
- [config](packages/config/README.md)
- [contracts](packages/contracts/README.md)
- [data-support](packages/data-support/README.md)
- [db-core](packages/db-core/README.md)
- [diagnostics](packages/diagnostics/README.md)
- [execution](packages/execution/README.md)
- [gateways](packages/gateways/README.md)
- [governance](packages/governance/README.md)
- [logger](packages/logger/README.md)
- [metadata](packages/metadata/README.md)
- [plugins](packages/plugins/README.md)
- [queue-core](packages/queue-core/README.md)
- [repositories](packages/repositories/README.md)
- [selectors](packages/selectors/README.md)
- [ui-components](packages/ui-components/README.md)
- [ui-core](packages/ui-core/README.md)
- [ui-driver](packages/ui-driver/README.md)
- [ui-flows](packages/ui-flows/README.md)
- [utils](packages/utils/README.md)

## CI/CD

- GitHub Actions is configured for repository CI and runs core validation/build plus e2e in separate jobs.
- GitLab CI configuration is provided for GitLab-based projects and should be validated in the target GitLab environment.
- e2e jobs install Playwright Chromium before running browser tests.
- CI artifact paths include `artifacts/`, `coverage/`, `playwright-report/`, and `test-results/` where those folders are produced.

## Artifacts and diagnostics

- Playwright HTML report: `playwright-report/`.
- Playwright traces/screenshots/videos: `test-results/`.
- Platform diagnostics bundles: `artifacts/diagnostics/<executionId>/`.
- Diagnostics plugin reports: `artifacts/plugins/...`.
- Coverage, when generated by future coverage scripts, should live under `coverage/`.

## Limitations

- The demo app uses local JSON files and an in-memory queue; it is not a replacement for a real service environment.
- `db-core` requires PostgreSQL for real database integration; local CI does not provision PostgreSQL.
- Some packages are contracts or starter abstractions with typecheck/showcase coverage rather than dedicated unit tests.
- Browser coverage is Chromium-only until there is a real multi-browser requirement.
- `npm audit` currently reports vulnerabilities; dependency security remediation should be handled as a separate controlled change.

## Known risks

- Docs and examples can drift from source exports; `npm run validate:docs` exists to catch common drift.
- File-backed demo data can accumulate if a process is killed before cleanup; generated data is ignored by git.
- The UI wrapper is intentionally thin; complex browser assertions should stay in Playwright tests.

## Next steps

1. Add focused unit tests for packages that currently rely on typecheck/showcase coverage.
2. Decide whether `db-core` should get a containerized PostgreSQL integration test job.
3. Add coverage reporting only after deciding which packages should own coverage thresholds.
