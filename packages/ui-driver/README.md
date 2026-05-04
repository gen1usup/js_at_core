# @automation-platform/ui-driver

## Purpose

Implements the platform UI driver contract with Playwright runtime primitives and diagnostics capture.

## Scope

- `PlaywrightUiDriver` controls browser/context/page lifecycle.
- Supports locator-first actions through Playwright under the contract boundary.
- Captures console, failed requests, screenshots, HTML, cookies/storage, dialogs, and tabs.

## Non-goals

- Replacing `@playwright/test`.
- Defining assertions.
- Creating a custom browser framework.

## Public API

- `BrowserLaunchConfig`
- `UiDriverHooks`
- `DriverDiagnosticsSnapshot`
- `PlaywrightUiDriver`

## Basic usage

```ts
import { type BrowserLaunchConfig, PlaywrightUiDriver } from '@automation-platform/ui-driver';

const config: BrowserLaunchConfig = {
  headless: true,
  viewport: { width: 1280, height: 720 },
  slowMoMs: 0,
  defaultNavigationTimeoutMs: 10000
};

const driver = await PlaywrightUiDriver.launch(config, logger);
await driver.goto('http://127.0.0.1:3010');
await driver.close();
```

## Integration

Use this wrapper for the platform `UIDriver` contract. Use raw `@playwright/test` for specs in `tests/e2e`.

## Configuration

`BrowserLaunchConfig` controls headless mode, viewport, base URL, timeouts, and launch behavior.

## Error handling

Driver action failures surface as UI action errors and diagnostics can be collected after failures.

## Testing

Covered by typecheck and Playwright e2e scenarios.

## Limitations

The wrapper is intentionally thin and should not duplicate Playwright Test features.

## Extension points

Extend diagnostics or contract methods only when a platform-level caller needs them.
