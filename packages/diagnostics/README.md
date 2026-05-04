# @automation-platform/diagnostics

## Purpose

Collects failure artifacts into a structured diagnostics bundle for easier debugging.

## Scope

- `DiagnosticsCollector` writes artifacts.
- `createFailureBundle` creates manifests.
- `UIDiagnosticsProvider` describes optional UI evidence.

## Non-goals

- Rendering reports.
- Uploading artifacts.
- Replacing Playwright traces.

## Public API

- `UIDiagnosticsProvider`
- `DiagnosticsStorageOptions`
- `ApiTraceRecord`
- `DbTraceRecord`
- `QueueTraceRecord`
- `FailureBundleInput`
- `DiagnosticsCollector`
- `createFailureBundle`

## Basic usage

```ts
import { createFailureBundle } from '@automation-platform/diagnostics';

const bundle = await createFailureBundle({
  context,
  stepName: 'demo.step',
  error: new Error('example failure')
});
```

## Integration

Used by diagnostics showcase and the diagnostics report plugin.

## Configuration

Artifacts are written under `artifacts/diagnostics/<executionId>/`.

## Error handling

Artifact write failures are wrapped in `DiagnosticsError`.

## Testing

Covered by diagnostics unit tests and `diagnostics-artifacts.test.ts`.

## Limitations

Artifact collection is local-file based.

## Extension points

Add new artifact types through `DiagnosticsCollector.register`.
