# @automation-platform/api-core

## Purpose

Provides a typed HTTP client wrapper for automation tests that need retries, auth token injection, response validation, polling, and normalized API errors.

## Scope

- `AxiosHttpClient` implements the shared HTTP contract.
- `UnifiedApiError` normalizes API failures.
- `paginatedResponseSchema` helps validate paged data.

## Non-goals

- Service-specific repositories.
- Browser testing.
- Database access.

## Public API

- `AxiosHttpClient`
- `ApiClientConfig`
- `ApiRequestOptions`
- `PaginatedResponse`
- `ApiErrorShape`
- `UnifiedApiError`
- `paginatedResponseSchema`

## Basic usage

```ts
import { AxiosHttpClient } from '@automation-platform/api-core';
import { createLogger } from '@automation-platform/logger';

const client = new AxiosHttpClient({
  baseUrl: 'http://127.0.0.1:3010',
  timeoutMs: 5000,
  retry: { maxAttempts: 2, delayMs: 50, backoffFactor: 1 },
  logger: createLogger({ level: 'info', serviceName: 'api-example', environment: 'test' })
});

const response = await client.send<{ ok: boolean }>({ method: 'GET', path: '/health' });
```

## Integration

Used by API showcase tests and repository examples to talk to the demo app.

## Configuration

Requires base URL, timeout, retry policy, logger, and optional auth token provider.

## Error handling

Transport, status, and schema failures are surfaced as platform API errors.

## Testing

Covered by API showcase tests. Run `npm test`.

## Limitations

It is a pragmatic client wrapper, not an SDK generator.

## Extension points

Add domain repositories on top of `HttpClient` rather than embedding endpoints here.
