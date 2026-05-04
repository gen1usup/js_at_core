# @automation-platform/execution

## Purpose

Provides execution context, cleanup registry, step runner, timeout handling, and cleanup orchestration.

## Scope

- `createExecutionContext` builds runtime context.
- `StepRunner` wraps named async steps.
- `runWithCleanup` guarantees cleanup.

## Non-goals

- Being a test runner.
- Distributed scheduling.
- Reporting ownership.

## Public API

- `CreateExecutionContextInput`
- `InMemoryResourceRegistry`
- `OrderedCleanupRegistry`
- `StepHooks`
- `StepRunOptions`
- `StepRunner`
- `withTimeout`
- `createExecutionContext`
- `runWithCleanup`

## Basic usage

```ts
import { createExecutionContext, StepRunner } from '@automation-platform/execution';

const context = createExecutionContext({
  projectName,
  environment,
  capabilityMap,
  featureFlags,
  logger
});
const runner = new StepRunner(context);
await runner.run('api.health', () => client.send({ method: 'GET', path: '/health' }));
```

## Integration

Used by showcase tests, diagnostics, plugins, and cleanup examples.

## Configuration

Requires project/environment names, capabilities, feature flags, logger, and optional metadata.

## Error handling

Timeouts throw `TimeoutError`; critical cleanup failures throw `CleanupError`.

## Testing

Covered by execution unit tests and real demo integration.

## Limitations

Step timing is local-process only.

## Extension points

Use hooks for lightweight instrumentation; keep heavy reporting outside.
