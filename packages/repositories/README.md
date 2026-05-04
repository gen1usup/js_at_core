# @automation-platform/repositories

## Purpose

Provides reusable repository base classes and template repositories over API and DB contracts.

## Scope

- `BaseApiRepository` and `BaseDbRepository` implement common CRUD-like patterns.
- `TemplateApiRepository` and `TemplateDbRepository` demonstrate concrete usage.

## Non-goals

- All domain repositories.
- Transport ownership.
- Schema generation.

## Public API

- `EntityWithId`
- `BaseApiRepository`
- `BaseDbRepository`
- `TemplateEntity`
- `TemplateApiRepository`
- `TemplateDbRepository`

## Basic usage

```ts
import { TemplateApiRepository } from '@automation-platform/repositories';

const repository = new TemplateApiRepository(apiClient, logger);
const entity = await repository.getById('entity-1');
```

## Integration

Used by gateways and showcase tests to demonstrate repository boundaries.

## Configuration

API repositories need `HttpClient`; DB repositories need `DatabaseClient`.

## Error handling

Transport errors come from the underlying API/DB clients.

## Testing

Covered by repository unit tests. Run `npm test`.

## Limitations

Template repositories are examples and should be replaced by project-specific repositories.

## Extension points

Subclass base repositories for domain entities and inject transport details.
