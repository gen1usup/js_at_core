# @automation-platform/gateways

## Purpose

Shows a gateway layer for command-style interactions over repositories and queues.

## Scope

- `TemplateEntityGateway` creates and updates entities.
- `CreateEntityCommand` and `UpdateStatusCommand` define example commands.

## Non-goals

- Domain-specific services.
- Persistence primitives.
- Cross-service orchestration.

## Public API

- `CreateEntityCommand`
- `UpdateStatusCommand`
- `TemplateEntityGateway`

## Basic usage

```ts
import { TemplateEntityGateway } from '@automation-platform/gateways';

const gateway = new TemplateEntityGateway(
  apiRepository,
  dbRepository,
  queueClient,
  context,
  logger
);
const entity = await gateway.create({ name: 'demo' });
```

## Integration

Used by template and core showcase tests with repository and queue contracts.

## Configuration

Construct with repository, queue, logger, and expected queue naming options.

## Error handling

Repository or queue failures propagate from the underlying contract implementation.

## Testing

Covered by gateway unit tests and showcase tests.

## Limitations

The included gateway is a template example.

## Extension points

Create project-specific gateways that depend on contracts.
