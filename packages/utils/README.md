# @automation-platform/utils

## Purpose

Provides shared platform errors, retry/wait helpers, masking, ID creation, and safe object utilities.

## Scope

- Typed platform error classes.
- `waitFor`, `retry`, and `sleep` primitives.
- Sensitive-data masking and safe JSON helpers.

## Non-goals

- Business logic.
- Replacing framework-specific assertions.
- Logging by itself.

## Public API

- `ErrorDetails`
- `PlatformError`
- `ConfigError`
- `SelectorResolutionError`
- `UIActionError`
- `ApiTransportError`
- `ApiValidationError`
- `DbOperationError`
- `QueueOperationError`
- `TimeoutError`
- `DiagnosticsError`
- `CleanupError`
- `sleep`
- `WaitForOptions`
- `waitFor`
- `retry`
- `isSensitiveKey`
- `maskString`
- `maskSensitive`
- `createExecutionId`
- `createCorrelationId`
- `nowIso`
- `toError`
- `safeJsonStringify`
- `assertCapability`
- `asRecord`

## Basic usage

```ts
import { retry, waitFor } from '@automation-platform/utils';

await retry(() => doApiCall(), { maxAttempts: 2, delayMs: 50, backoffFactor: 1 });
await waitFor(
  async () => {
    const status = await readStatus();
    return status === 'ready' ? status : undefined;
  },
  {
    timeoutMs: 5000,
    pollingIntervalMs: 100,
    description: 'status ready'
  }
);
```

## Integration

Used by config, diagnostics, execution, API, queue, selectors, and UI packages.

## Configuration

Retry and wait helpers accept explicit timeout/interval policies.

## Error handling

Exports typed platform errors used throughout the repository.

## Testing

Covered by utils unit tests and indirect package tests. Run `npm test`.

## Limitations

For browser e2e, prefer Playwright auto-waiting and assertions over generic waits.

## Extension points

Keep utilities small and cross-cutting; avoid domain-specific helpers here.
