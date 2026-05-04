# @automation-platform/contracts

## Purpose

Defines shared TypeScript contracts used by platform packages so implementations stay decoupled.

## Scope

- Logger, metadata, execution, cleanup, UI, HTTP, DB, queue, plugin, and CLI interfaces.
- Shared primitive domain types such as capabilities and risk levels.

## Non-goals

- Runtime behavior.
- Project-specific business logic.
- External service setup.

## Public API

- `PlatformLogger`
- `UIDriver`
- `HttpClient`
- `DatabaseClient`
- `QueueClient`
- `ExecutionContext`
- `TestMetadata`
- `PlatformPlugin`
- `ProjectAdapter`

## Basic usage

```ts
import type { HttpClient } from '@automation-platform/contracts';

const readHealth = (client: HttpClient) =>
  client.send<{ ok: boolean }>({
    method: 'GET',
    path: '/health'
  });
```

## Integration

Most packages import these types to avoid runtime coupling.

## Configuration

No runtime configuration.

## Error handling

No runtime error handling; this package is types only.

## Testing

Covered by `npm run typecheck`.

## Limitations

Contracts are evolving starter-kit interfaces, not frozen external API.

## Extension points

Prefer small focused interfaces over broad catch-all contracts.
