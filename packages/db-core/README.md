# @automation-platform/db-core

## Purpose

Provides a PostgreSQL-backed implementation of the platform database client contract.

## Scope

- `dbConfigSchema` validates connection settings.
- `PostgresDatabaseClient` wraps query execution and transactions.

## Non-goals

- Starting PostgreSQL.
- Migrations.
- In-memory DB replacement.

## Public API

- `dbConfigSchema`
- `DbConfig`
- `PostgresDatabaseClient`

## Basic usage

```ts
import { PostgresDatabaseClient } from '@automation-platform/db-core';
import { createLogger } from '@automation-platform/logger';

const db = new PostgresDatabaseClient(
  {
    connectionString: process.env.DATABASE_URL,
    maxConnections: 4,
    statementTimeoutMs: 5000,
    readOnly: true,
    environment: 'test',
    writeAllowedEnvironments: ['local']
  },
  createLogger({ level: 'info', serviceName: 'db-example', environment: 'test' })
);
```

## Integration

Repository examples can target `DatabaseClient`; real DB work requires PostgreSQL.

## Configuration

Requires PostgreSQL connection settings.

## Error handling

Driver errors are wrapped when the implementation has operation context.

## Testing

No local PostgreSQL job is configured; covered by `npm run typecheck`.

## Limitations

Local CI does not provision PostgreSQL.

## Extension points

Add containerized DB tests before expanding this layer.
