# @automation-platform/logger

## Purpose

Creates a small structured logger that masks sensitive metadata before output.

## Scope

- `createLogger` creates a platform logger.
- `sanitizeLogMeta` masks secrets.
- `withLoggerContext` adds contextual fields.

## Non-goals

- External log shipping.
- Retention management.
- Full observability platform.

## Public API

- `LoggerFactoryOptions`
- `LoggerContext`
- `sanitizeLogMeta`
- `createLogger`
- `withLoggerContext`

## Basic usage

```ts
import { createLogger } from '@automation-platform/logger';

const logger = createLogger({ level: 'info', serviceName: 'showcase', environment: 'test' });
logger.info('step completed', { token: 'secret-value' });
```

## Integration

Used by most runtime packages for consistent platform logging.

## Configuration

Requires log level, service name, and environment.

## Error handling

The logger masks sensitive fields and writes to console streams.

## Testing

Covered by logger unit tests.

## Limitations

Output is console-oriented and intentionally simple.

## Extension points

Wrap `PlatformLogger` if a project needs a log backend.
